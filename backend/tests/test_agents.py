"""N-09 agent runner: mock / claude / boomi backends, orchestrator, trigger wiring. No network."""

import json
import time
from types import SimpleNamespace
from unittest import mock

import anthropic
import httpx
import pytest
from django.core.management import call_command

from apps.audit.models import AuditEvent
from apps.core.models import AgentRun, Recommendation, RiskCase
from apps.intelligence import agents
from apps.intelligence.agents import boomi as boomi_backend
from apps.intelligence.agents import claude as claude_backend
from apps.intelligence.agents import mock as mock_backend
from apps.intelligence.agents.orchestrator import run_analysis_for_case
from apps.intelligence.agents.payload import build_agent_input
from apps.intelligence.agents.prompts import system_prompt
from apps.intelligence.validation import RECOVERY_PLAN, RISK_ANALYSIS, validate_agent_output
from tests.factories import make_user
from tests.helpers import api_key_client, jwt_client
from tests.test_risk_case_callback import DEMO, demo_snapshot

pytestmark = pytest.mark.django_db
SIM = "/api/v1/demo/simulate-disruption"
CASES = "/api/v1/internal/risk-cases"
EVENTS = "/api/v1/events/disruptions"


@pytest.fixture
def acme(db):
    call_command("load_seed", stdout=mock.MagicMock())
    from apps.tenants.models import Tenant

    return Tenant.objects.get(id="TEN-ACME")


@pytest.fixture
def case(acme, monkeypatch):
    """The demo case in ANALYZING, created like Boomi's callback does (no analysis started)."""
    key = api_key_client(acme)
    assert key.post(EVENTS, DEMO["event"], format="json").status_code == 202
    r = key.post(
        CASES, {"event_id": DEMO["event"]["event_id"], "snapshot": demo_snapshot()}, format="json"
    )
    assert r.status_code == 201, r.content
    return RiskCase.objects.get(pk=r.json()["risk_case_id"])


@pytest.fixture
def offline(monkeypatch):
    monkeypatch.setenv("OFFLINE_CORRELATION", "1")
    monkeypatch.setenv("AGENT_BACKEND", "mock")


def simulate(acme, scenario, capture):
    admin = jwt_client(make_user(acme, role="ADMIN"))
    started = time.perf_counter()
    with capture(execute=True):
        r = admin.post(SIM, {"scenario": scenario}, format="json")
    elapsed = time.perf_counter() - started
    assert r.status_code == 200, r.content
    return RiskCase.objects.get(event__event_id=r.json()["event_id"]), elapsed


def audits(action):
    return AuditEvent.objects.filter(action=action)


def valid(kind, payload, case):
    res = validate_agent_output(
        kind,
        payload,
        case.snapshot,
        case.impact,
        event=agents.payload._event_dict(case.event),
        risk_case_id=case.id,
    )
    return res["valid"], res["schema_errors"] + res["fact_errors"]


# --- mock, end to end --------------------------------------------------------------------------
def test_simulate_demo_ends_pending_approval_with_four_recommendations_fast(
    acme, offline, django_capture_on_commit_callbacks
):
    case, elapsed = simulate(acme, "demo", django_capture_on_commit_callbacks)
    assert case.status == "PENDING_APPROVAL"
    assert Recommendation.objects.filter(risk_case=case, round=case.analysis_round).count() == 4
    runs = AgentRun.objects.filter(risk_case=case)
    assert sorted(runs.values_list("agent", flat=True)) == ["RECOVERY_PLANNER", "RISK_ANALYST"]
    assert all(r.valid for r in runs)
    assert case.analysis["risk_score"] == case.impact["risk_score"]
    assert elapsed < 5, f"simulate -> PENDING_APPROVAL took {elapsed:.2f}s"


def test_tc05_simulate_closes_the_case(acme, offline, django_capture_on_commit_callbacks):
    case, _ = simulate(acme, "tc05_no_alternates", django_capture_on_commit_callbacks)
    assert case.status == "CLOSED"
    assert Recommendation.objects.filter(risk_case=case).count() == 0
    assert all(r.valid for r in AgentRun.objects.filter(risk_case=case))


def test_scenario_without_fixture_gets_a_valid_minimal_output(
    acme, offline, django_capture_on_commit_callbacks
):
    case, _ = simulate(acme, "tc03_multiple_open_pos", django_capture_on_commit_callbacks)
    runs = AgentRun.objects.filter(risk_case=case)
    assert runs.count() == 2 and all(r.valid for r in runs)
    plan = runs.get(agent="RECOVERY_PLANNER").raw
    assert plan["options"] == [] and plan["no_viable_option_reason"]
    assert case.status == "CLOSED"


def test_offline_correlation_is_off_unless_enabled(acme, django_capture_on_commit_callbacks):
    admin = jwt_client(make_user(acme, role="ADMIN"))
    with django_capture_on_commit_callbacks(execute=True):
        assert admin.post(SIM, {"scenario": "demo"}, format="json").status_code == 200
    assert RiskCase.objects.count() == 0


def test_mock_outputs_are_valid_for_the_demo_case(case):
    risk = mock_backend.run_risk_analyst(case)
    assert valid(RISK_ANALYSIS, risk, case) == (True, [])
    plan = mock_backend.run_recovery_planner(case, risk)
    assert valid(RECOVERY_PLAN, plan, case)[0]
    assert plan["risk_case_id"] == case.id and len(plan["options"]) == 4


# --- input + prompt ----------------------------------------------------------------------------
def test_agent_input_uses_the_stored_snapshot_and_impact(case):
    risk = mock_backend.run_risk_analyst(case)
    ra = build_agent_input(case, "RISK_ANALYST")
    assert ra["risk_case_id"] == case.id and ra["impact"] == case.impact
    assert ra["snapshot"]["purchase_orders"] == case.snapshot["purchase_orders"]
    assert ra["event"]["event_id"] == case.event.event_id and "risk_analysis" not in ra
    rp = build_agent_input(case, "RECOVERY_PLANNER", risk)
    assert rp["risk_analysis"] == risk and "constraints" in rp
    with pytest.raises(ValueError):
        build_agent_input(case, "RECOVERY_PLANNER")


def test_system_prompts_are_the_deployed_instruction_texts():
    assert system_prompt("RISK_ANALYST").startswith("You are the Supplier Risk Analyst")
    assert system_prompt("RECOVERY_PLANNER").startswith("You are the Recovery Planner")


# --- claude (SDK client mocked) ----------------------------------------------------------------
class FakeMessages:
    def __init__(self, script):
        self.script, self.calls = list(script), []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        item = self.script.pop(0) if len(self.script) > 1 else self.script[0]
        if isinstance(item, Exception):
            raise item
        return item


def reply(payload, stop_reason="end_turn"):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)], stop_reason=stop_reason
    )


@pytest.fixture
def fake_claude(monkeypatch):
    def install(*script):
        fake = SimpleNamespace(messages=FakeMessages(script))
        monkeypatch.setattr(claude_backend, "_client", lambda: fake)
        monkeypatch.setattr(claude_backend.time, "sleep", lambda s: None)
        monkeypatch.setenv("AGENT_BACKEND", "claude")
        return fake.messages

    return install


def timeout_error():
    return anthropic.APITimeoutError(request=httpx.Request("POST", "https://api.anthropic.com"))


def test_claude_request_shape_and_schema_valid_parse(case, fake_claude):
    risk = mock_backend.run_risk_analyst(case)
    messages = fake_claude(reply(risk))
    out = agents.run_risk_analyst(case)
    assert out == risk and valid(RISK_ANALYSIS, out, case)[0]
    (call,) = messages.calls
    assert call["model"] == "claude-sonnet-5-5"
    assert call["system"] == system_prompt("RISK_ANALYST")
    for banned in ("temperature", "top_p", "tool_choice", "thinking"):
        assert banned not in call
    sent = json.loads(call["messages"][0]["content"])
    assert sent == build_agent_input(case, "RISK_ANALYST")
    schema = call["output_config"]["format"]["schema"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "$ref" not in json.dumps(schema) and "pattern" not in json.dumps(schema)
    assert schema["additionalProperties"] is False and "risk_score" in schema["properties"]


def test_claude_recovery_planner_gets_the_risk_analysis(case, fake_claude):
    risk = mock_backend.run_risk_analyst(case)
    plan = mock_backend.run_recovery_planner(case, risk)
    messages = fake_claude(reply(plan))
    assert agents.run_recovery_planner(case, risk, feedback="prefer SUP-2001") == plan
    (call,) = messages.calls
    assert call["system"] == system_prompt("RECOVERY_PLANNER")
    text = call["messages"][0]["content"]
    assert '"risk_analysis"' in text and "prefer SUP-2001" in text
    assert "options" in call["output_config"]["format"]["schema"]["properties"]


def test_claude_retries_transient_errors_then_succeeds(case, fake_claude):
    risk = mock_backend.run_risk_analyst(case)
    messages = fake_claude(timeout_error(), timeout_error(), reply(risk))
    assert agents.run_risk_analyst(case) == risk
    assert len(messages.calls) == 3


def test_claude_retry_is_bounded(case, fake_claude, monkeypatch):
    monkeypatch.setenv("AGENT_CLAUDE_RETRIES", "1")
    messages = fake_claude(timeout_error())
    with pytest.raises(agents.AgentError, match="2 attempts"):
        agents.run_risk_analyst(case)
    assert len(messages.calls) == 2


def test_claude_client_is_built_with_timeout_and_no_sdk_retries(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-not-real")
    monkeypatch.setenv("AGENT_CLAUDE_TIMEOUT", "12")
    with mock.patch.object(anthropic, "Anthropic") as cls:
        claude_backend._client()
    cls.assert_called_once_with(api_key="sk-ant-test-not-real", timeout=12.0, max_retries=0)


def test_claude_without_key_is_a_config_error(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "claude")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(agents.AgentConfigError, match="ANTHROPIC_API_KEY"):
        agents.run_risk_analyst(case)


def test_claude_schema_rejected_falls_back_without_output_config(case, fake_claude):
    risk = mock_backend.run_risk_analyst(case)
    bad = anthropic.BadRequestError(
        "invalid schema",
        response=httpx.Response(400, request=httpx.Request("POST", "https://x")),
        body=None,
    )
    messages = fake_claude(bad, reply(risk))
    assert agents.run_risk_analyst(case) == risk
    assert "output_config" in messages.calls[0] and "output_config" not in messages.calls[1]


def test_invalid_json_from_the_model_is_stored_as_an_invalid_agent_run(case, fake_claude):
    fake_claude(reply("Sorry, here is some prose, not JSON"))
    assert run_analysis_for_case(case) is False
    (run,) = AgentRun.objects.filter(risk_case=case)
    assert run.valid is False and run.agent == "RISK_ANALYST"
    assert "not JSON" in run.raw["unparseable_output"]
    assert run.validation_errors
    case.refresh_from_db()
    assert case.status == "ANALYZING"
    assert audits("analysis.agent_output_invalid").count() == 1


def test_schema_invalid_json_is_stored_invalid_and_stops(case, fake_claude):
    fake_claude(reply({"risk_case_id": case.id}))
    assert run_analysis_for_case(case) is False
    (run,) = AgentRun.objects.filter(risk_case=case)
    assert run.valid is False and run.raw == {"risk_case_id": case.id}


def test_claude_failure_leaves_case_analyzing_and_is_audited(case, fake_claude, monkeypatch):
    monkeypatch.setenv("AGENT_CLAUDE_RETRIES", "0")
    fake_claude(timeout_error())
    assert run_analysis_for_case(case) is False
    case.refresh_from_db()
    assert case.status == "ANALYZING" and AgentRun.objects.count() == 0
    (row,) = audits("analysis.agent_failed")
    assert row.data["agent"] == "RISK_ANALYST" and row.data["backend"] == "claude"


def test_claude_end_to_end_with_recorded_responses(case, fake_claude):
    risk = mock_backend.run_risk_analyst(case)
    plan = mock_backend.run_recovery_planner(case, risk)
    fake_claude(reply(risk), reply(plan))
    assert run_analysis_for_case(case) is True
    case.refresh_from_db()
    assert case.status == "PENDING_APPROVAL"
    assert Recommendation.objects.filter(risk_case=case).count() == 4


# --- boomi (httpx mocked) ----------------------------------------------------------------------
BOOMI_ENV = {
    "AGENTSTUDIO_EXECUTE_URL": "https://execute.example.test/",
    "BOOMI_ACCOUNT_ID": "acct-1",
    "BOOMI_USERNAME": "svc@example.test",
    "BOOMI_API_TOKEN": "tok-not-real",
    "AGENTSTUDIO_RISK_ANALYST_DEPLOYMENT_ID": "dep-risk",
    "AGENTSTUDIO_RECOVERY_PLANNER_DEPLOYMENT_ID": "dep-plan",
}


@pytest.fixture
def boomi_agents(monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "boomi")
    for k, v in BOOMI_ENV.items():
        monkeypatch.setenv(k, v)
    seen = []

    def install(handler):
        def wrapped(request):
            seen.append(request)
            return handler(request)

        monkeypatch.setattr(boomi_backend, "_transport", lambda: httpx.MockTransport(wrapped))
        return seen

    return install


def test_boomi_request_and_recorded_response(case, boomi_agents):
    risk = mock_backend.run_risk_analyst(case)
    seen = boomi_agents(
        lambda r: httpx.Response(
            200, json={"success": True, "agent_id": "a", "session_id": "s", "data": risk}
        )
    )
    assert agents.run_risk_analyst(case) == risk and valid(RISK_ANALYSIS, risk, case)[0]
    (request,) = seen
    assert str(request.url) == "https://execute.example.test/execute/api/v1/acct-1/session"
    body = json.loads(request.content)
    assert body["deployment_id"] == "dep-risk"
    assert body["message"] == build_agent_input(case, "RISK_ANALYST")
    import base64

    assert (
        request.headers["authorization"]
        == "Basic " + base64.b64encode(b"BOOMI_TOKEN.svc@example.test:tok-not-real").decode()
    )


def test_boomi_recovery_planner_uses_its_own_deployment(case, boomi_agents):
    risk = mock_backend.run_risk_analyst(case)
    plan = mock_backend.run_recovery_planner(case, risk)
    seen = boomi_agents(
        lambda r: httpx.Response(200, json={"success": True, "data": json.dumps(plan)})
    )
    assert agents.run_recovery_planner(case, risk) == plan
    body = json.loads(seen[0].content)
    assert body["deployment_id"] == "dep-plan" and body["message"]["risk_analysis"] == risk


def test_boomi_not_configured_is_a_clear_error(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "boomi")
    for k in BOOMI_ENV:
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(agents.AgentConfigError, match="AGENTSTUDIO_EXECUTE_URL"):
        agents.run_risk_analyst(case)


@pytest.mark.parametrize(
    "response",
    [
        lambda r: httpx.Response(500, text="boom tok-not-real"),
        lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("slow", request=r)),
        lambda r: (_ for _ in ()).throw(httpx.ConnectError("down", request=r)),
    ],
)
def test_boomi_transport_failures_are_agent_errors_without_secrets(case, boomi_agents, response):
    boomi_agents(response)
    with pytest.raises(agents.AgentError) as exc:
        agents.run_risk_analyst(case)
    assert "tok-not-real" not in str(exc.value)


def test_boomi_reply_without_object_is_an_output_error(case, boomi_agents):
    boomi_agents(lambda r: httpx.Response(200, json={"success": True, "data": "not json"}))
    with pytest.raises(agents.AgentOutputError):
        agents.run_risk_analyst(case)


def test_boomi_end_to_end_with_recorded_responses(case, boomi_agents):
    risk = mock_backend.run_risk_analyst(case)
    plan = mock_backend.run_recovery_planner(case, risk)

    def handler(request):
        data = plan if json.loads(request.content)["deployment_id"] == "dep-plan" else risk
        return httpx.Response(200, json={"success": True, "data": data})

    boomi_agents(handler)
    assert run_analysis_for_case(case) is True
    case.refresh_from_db()
    assert case.status == "PENDING_APPROVAL"


def test_boomi_failure_leaves_case_analyzing(case, boomi_agents):
    boomi_agents(lambda r: httpx.Response(503))
    assert run_analysis_for_case(case) is False
    case.refresh_from_db()
    assert case.status == "ANALYZING" and audits("analysis.agent_failed").count() == 1


# --- switching + orchestrator safety -----------------------------------------------------------
def test_backend_is_switched_by_the_env_var_alone(case, monkeypatch):
    monkeypatch.delenv("AGENT_BACKEND", raising=False)
    assert agents.config.backend_name() == "mock"  # default
    sentinel = {"who": None}
    for name in ("mock", "claude", "boomi"):
        module = getattr(agents, name)
        monkeypatch.setattr(
            module,
            "run_risk_analyst",
            lambda c, feedback="", _n=name: sentinel.update(who=_n) or {},
        )
    for name in ("claude", "boomi", "mock"):
        monkeypatch.setenv("AGENT_BACKEND", name)
        agents.run_risk_analyst(case)
        assert sentinel["who"] == name
    monkeypatch.setenv("AGENT_BACKEND", "gpt")
    with pytest.raises(agents.AgentConfigError):
        agents.run_risk_analyst(case)


def test_orchestrator_never_raises_and_audits_a_crash(case, monkeypatch):
    monkeypatch.setattr(
        "apps.intelligence.agents.orchestrator.run_risk_analyst",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("kaboom")),
    )
    assert run_analysis_for_case(case) is False
    assert audits("analysis.crashed").count() == 1


def test_orchestrator_skips_a_case_that_is_not_analyzing(case, monkeypatch):
    from apps.core.models.cases import status_change_allowed

    with status_change_allowed():
        case.status = "CLOSED"
        case.save(update_fields=["status"])
    assert run_analysis_for_case(case) is False
    assert AgentRun.objects.count() == 0


def test_second_run_after_completion_is_a_noop(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    assert run_analysis_for_case(case) is True
    assert run_analysis_for_case(case) is False
    assert AgentRun.objects.filter(risk_case=case).count() == 2


def test_trigger_setting_points_at_the_real_trigger(settings):
    from django.conf import settings as dj

    assert dj.WORKFLOW_ANALYSIS_TRIGGER.endswith("agents.orchestrator.AgentAnalysisTrigger")
