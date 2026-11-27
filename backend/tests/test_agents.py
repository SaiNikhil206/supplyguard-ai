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
    monkeypatch.setenv("AGENT_RUN_SYNC", "1")
    monkeypatch.setenv("AGENT_RUN_SYNC", "1")


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
    assert ra["risk_case_id"] == case.id and ra["impact"]["risk_score"] == case.impact["risk_score"]
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
    assert agents.config.backend_name() == "none"  # default: no agent output
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
    monkeypatch.delenv("AGENT_BACKEND")
    with pytest.raises(agents.AgentConfigError, match="not set"):
        agents.run_risk_analyst(case)
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


# --- review fixes ------------------------------------------------------------------------------
import threading  # noqa: E402

from django.core.management import call_command as _call_command  # noqa: E402

from apps.intelligence.agents import runner  # noqa: E402
from apps.intelligence.agents.orchestrator import AgentAnalysisTrigger  # noqa: E402
from apps.intelligence.agents.payload import AgentInputInvalid, validate_input  # noqa: E402
from apps.workflow.hooks import AnalysisRequest  # noqa: E402


def request_for(case, round_=None):
    return AnalysisRequest(
        tenant_id=case.tenant_id,
        risk_case_id=case.id,
        round=round_ or case.analysis_round,
        reason="t",
        feedback="",
        correlation_id=str(case.correlation_id),
    )


def test_agent_input_matches_agent_input_schema_exactly(case):
    for agent in ("RISK_ANALYST", "RECOVERY_PLANNER"):
        risk = mock_backend.run_risk_analyst(case) if agent == "RECOVERY_PLANNER" else None
        payload = build_agent_input(case, agent, risk)
        assert validate_input(payload) == []
        assert "shipment_id" not in payload["event"] and "po_id" not in payload["event"]
        assert set(payload["impact"]) == {"risk_score", "total_exposure", "affected_pos"}
        for po in payload["impact"]["affected_pos"]:
            assert "due_date" not in po and "line_nos" not in po
        assert "shipments" not in payload["snapshot"]


def test_invalid_agent_input_is_audited_and_the_agent_is_not_called(case, fake_claude):
    messages = fake_claude(reply({}))
    RiskCase.objects.filter(pk=case.pk).update(impact={})
    with pytest.raises(AgentInputInvalid):
        build_agent_input(RiskCase.objects.get(pk=case.pk), "RISK_ANALYST")
    assert run_analysis_for_case(case) is False
    assert messages.calls == []
    (row,) = audits("analysis.input_invalid")
    assert row.data["agent"] == "RISK_ANALYST" and row.data["errors"]
    assert AgentRun.objects.count() == 0


def test_claude_request_has_headroom_and_effort(case, fake_claude):
    messages = fake_claude(reply(mock_backend.run_risk_analyst(case)))
    agents.run_risk_analyst(case)
    (call,) = messages.calls
    assert call["max_tokens"] >= 16000 and call["output_config"]["effort"] == "medium"
    assert 0 < call["timeout"] <= 60


@pytest.mark.parametrize("reason", ["max_tokens", "refusal"])
def test_claude_stop_reason_is_stored_as_an_invalid_agent_run(case, fake_claude, reason):
    fake_claude(reply('{"risk_case_id": "RC-0000', stop_reason=reason))
    assert run_analysis_for_case(case) is False
    (run,) = AgentRun.objects.filter(risk_case=case)
    assert run.valid is False and f"stop_reason={reason}" in run.raw["error"]


def test_boomi_body_is_only_message_and_deployment_and_ignores_feedback(case, boomi_agents):
    out = mock_backend.run_risk_analyst(case)
    seen = boomi_agents(lambda r: httpx.Response(200, json={"data": out}))
    agents.run_risk_analyst(case, feedback="please change")
    body = json.loads(seen[0].content)
    assert set(body) == {"message", "deployment_id"} and "user_message" not in body["message"]
    assert validate_input(body["message"]) == []


def test_boomi_requires_https_except_localhost(case, boomi_agents, monkeypatch):
    out = mock_backend.run_risk_analyst(case)
    seen = boomi_agents(lambda r: httpx.Response(200, json={"data": out}))
    monkeypatch.setenv("AGENTSTUDIO_EXECUTE_URL", "http://execute.example.test")
    with pytest.raises(agents.AgentConfigError, match="https"):
        agents.run_risk_analyst(case)
    assert seen == []
    monkeypatch.setenv("AGENTSTUDIO_EXECUTE_URL", "http://localhost:9000")
    assert agents.run_risk_analyst(case)


def test_boomi_call_is_bounded_by_the_total_deadline(case, boomi_agents, monkeypatch):
    from apps.intelligence.agents.config import deadline

    boomi_agents(lambda r: httpx.Response(200, json={"data": {"x": 1}}))
    captured = {}
    real = boomi_backend.httpx.Timeout

    def spy(value):
        captured["t"] = value
        return real(value)

    monkeypatch.setattr(boomi_backend.httpx, "Timeout", spy)
    with deadline(7):
        agents.run_risk_analyst(case)
    assert captured["t"] <= 7
    with deadline(0), pytest.raises(agents.AgentTimeout):
        agents.run_risk_analyst(case)


def test_total_deadline_audits_a_timeout_and_keeps_the_case_analyzing(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    monkeypatch.setenv("AGENT_TOTAL_TIMEOUT_SECONDS", "0")
    assert run_analysis_for_case(case) is False
    case.refresh_from_db()
    assert case.status == "ANALYZING" and audits("analysis.timeout").count() == 1


def test_run_is_audited_start_and_completion(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    assert run_analysis_for_case(case) is True
    assert audits("analysis.started").count() == 1
    assert audits("analysis.completed").count() == 1


def test_default_backend_none_only_logs_and_audits_through_the_stub(
    case, monkeypatch, django_capture_on_commit_callbacks
):
    from apps.workflow.hooks import get_analysis_trigger
    from apps.workflow.services import schedule_analysis

    monkeypatch.delenv("AGENT_BACKEND", raising=False)
    monkeypatch.setenv("AGENT_RUN_SYNC", "1")
    assert type(get_analysis_trigger()).__name__ == "AgentAnalysisTrigger"
    with django_capture_on_commit_callbacks(execute=True):
        schedule_analysis(case)
    assert audits("analysis.request_stubbed").count() == 1
    assert AgentRun.objects.count() == 0
    case.refresh_from_db()
    assert case.status == "ANALYZING"


def test_trigger_returns_at_once_and_runs_the_job_in_a_daemon_thread(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "claude")
    monkeypatch.delenv("AGENT_RUN_SYNC", raising=False)
    started, release = threading.Event(), threading.Event()

    def slow_job(request):
        started.set()
        release.wait(5)

    monkeypatch.setattr(runner, "run_job", slow_job)
    t0 = time.perf_counter()
    AgentAnalysisTrigger().request_analysis(request_for(case))
    elapsed = time.perf_counter() - t0
    try:
        assert started.wait(2) and elapsed < 1
        (worker,) = [t for t in threading.enumerate() if t.name == f"analysis-{case.id}"]
        assert worker.daemon
    finally:
        release.set()


def test_sync_flag_runs_inline(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    monkeypatch.setenv("AGENT_RUN_SYNC", "1")
    AgentAnalysisTrigger().request_analysis(request_for(case))
    case.refresh_from_db()
    assert case.status == "PENDING_APPROVAL"


def test_stale_round_request_is_ignored(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    monkeypatch.setenv("AGENT_RUN_SYNC", "1")
    runner.submit(request_for(case, round_=case.analysis_round + 1))
    assert AgentRun.objects.count() == 0


def stale(case):
    from datetime import timedelta

    from django.utils import timezone

    RiskCase.objects.filter(pk=case.pk).update(updated_at=timezone.now() - timedelta(hours=1))


def test_run_pending_analysis_recovers_a_stuck_case(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    stale(case)
    _call_command("run_pending_analysis", "--older-than", "60", stdout=mock.MagicMock())
    case.refresh_from_db()
    assert case.status == "PENDING_APPROVAL"


def test_run_pending_analysis_skips_fresh_cases_and_reuses_stored_risk_analysis(case, monkeypatch):
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    _call_command("run_pending_analysis", stdout=mock.MagicMock())  # fresh: untouched
    assert AgentRun.objects.count() == 0
    # the planner failed earlier: only the risk analysis exists
    with monkeypatch.context() as m:
        m.setattr(
            "apps.intelligence.agents.orchestrator.run_recovery_planner",
            lambda *a, **k: (_ for _ in ()).throw(agents.AgentError("down")),
        )
        assert run_analysis_for_case(case) is False
    assert AgentRun.objects.filter(agent="RISK_ANALYST").count() == 1
    monkeypatch.setattr(
        "apps.intelligence.agents.orchestrator.run_risk_analyst",
        lambda *a, **k: pytest.fail("risk analyst must not be called again"),
    )
    stale(case)
    _call_command("run_pending_analysis", "--older-than", "60", stdout=mock.MagicMock())
    case.refresh_from_db()
    assert case.status == "PENDING_APPROVAL"
    assert AgentRun.objects.filter(agent="RISK_ANALYST").count() == 1


def test_run_pending_analysis_does_nothing_without_a_backend(case, monkeypatch):
    monkeypatch.delenv("AGENT_BACKEND", raising=False)
    stale(case)
    _call_command("run_pending_analysis", "--older-than", "60", stdout=mock.MagicMock())
    assert AgentRun.objects.count() == 0


def test_mock_fixture_is_only_used_for_the_recorded_scenario(acme, monkeypatch):
    """A 30 h SUP-1008 event is not the demo: minimal answer, the case ends CLOSED."""
    monkeypatch.setenv("AGENT_BACKEND", "mock")
    key = api_key_client(acme)
    event = {
        **DEMO["event"],
        "event_id": "EVT-000950",
        "expected_duration_hours": 30,
        "correlation_id": "0f6c1c2e-0000-4000-8000-000000000950",
    }
    assert key.post(EVENTS, event, format="json").status_code == 202
    r = key.post(CASES, {"event_id": "EVT-000950", "snapshot": demo_snapshot()}, format="json")
    assert r.status_code == 201, r.content
    case = RiskCase.objects.get(pk=r.json()["risk_case_id"])
    assert run_analysis_for_case(case) is True
    case.refresh_from_db()
    assert case.status == "CLOSED"
    runs = AgentRun.objects.filter(risk_case=case)
    assert runs.count() == 2 and all(x.valid for x in runs)
    assert runs.get(agent="RECOVERY_PLANNER").raw["options"] == []


def test_startup_warns_loudly_when_mock_is_active(monkeypatch, caplog):
    from django.apps import apps

    monkeypatch.setenv("AGENT_BACKEND", "mock")
    with caplog.at_level("WARNING"):
        apps.get_app_config("intelligence").ready()
    assert any("CANNED FIXTURE DATA" in r.message for r in caplog.records)


def test_u06_callback_returns_fast_whatever_the_backend(
    acme, monkeypatch, django_capture_on_commit_callbacks
):
    monkeypatch.setenv("AGENT_BACKEND", "claude")
    monkeypatch.delenv("AGENT_RUN_SYNC", raising=False)
    release = threading.Event()
    monkeypatch.setattr(runner, "run_job", lambda request: release.wait(5))
    key = api_key_client(acme)
    assert key.post(EVENTS, DEMO["event"], format="json").status_code == 202
    t0 = time.perf_counter()
    with django_capture_on_commit_callbacks(execute=True):
        r = key.post(
            CASES,
            {"event_id": DEMO["event"]["event_id"], "snapshot": demo_snapshot()},
            format="json",
        )
    elapsed = time.perf_counter() - t0
    release.set()
    assert r.status_code == 201 and elapsed < 1
