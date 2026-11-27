"""Run both agents for one case and store the results (N-09).

`run_analysis_for_case(case)`: risk analyst -> record_analysis(RISK_ANALYSIS) -> recovery planner
-> record_analysis(RECOVERY_PLAN, round=case.analysis_round). Actor SYSTEM, never raises, one
hard total deadline (AGENT_TOTAL_TIMEOUT_SECONDS, default 90) over every call and retry. Audit
rows: analysis.started / completed / agent_failed / timeout / input_invalid /
agent_output_invalid / apply_failed / skipped / crashed. A failure leaves the case ANALYZING
(N-10: ANALYZING -> CLOSED is the manual way out; `run_pending_analysis` retries stuck cases).

`AgentAnalysisTrigger` is the real `AnalysisTrigger` (WORKFLOW_ANALYSIS_TRIGGER). With
AGENT_BACKEND unset (none) it behaves like the stub: log + audit, no agent output.
"""

import logging

from apps.core.models import AgentRun, RiskCase
from apps.intelligence.exceptions import AnalysisApplyFailed, AnalysisConflict
from apps.intelligence.services import record_analysis
from apps.intelligence.validation import RECOVERY_PLAN, RISK_ANALYSIS

from . import AgentError, AgentOutputError, run_recovery_planner, run_risk_analyst
from .config import AgentTimeout, backend_name, conf_float, deadline, remaining
from .payload import AgentInputInvalid

logger = logging.getLogger(__name__)
SYSTEM = "SYSTEM"
RAW_LIMIT = 20000
DEFAULT_TOTAL_TIMEOUT = 90.0


def _audit(case, action, **data):
    from apps.audit import record

    try:
        record(SYSTEM, action, case, correlation_id=case.correlation_id, data=data)
    except Exception:
        logger.exception("audit %s failed for %s", action, case.pk)


def _backend_label() -> str:
    try:
        return backend_name()
    except AgentError:
        return "invalid"


def _record(case, kind, payload):
    return record_analysis(
        tenant=case.tenant,
        case=case,
        kind=kind,
        payload=payload,
        actor=SYSTEM,
        correlation_id=case.correlation_id,
        round=case.analysis_round,
    )


def _step(case, kind, agent_name, call):
    """Call one agent and record its output. Returns the stored payload, or None to stop."""
    try:
        remaining(1.0)  # raises AgentTimeout when the total budget is already spent
        payload = call()
    except AgentOutputError as exc:  # answered, but not usable JSON: keep it as an invalid AgentRun
        payload = {"unparseable_output": (exc.raw or "")[:RAW_LIMIT], "error": str(exc)[:200]}
    except AgentInputInvalid as exc:  # our input is wrong: nothing was sent
        _audit(case, "analysis.input_invalid", agent=agent_name, errors=exc.errors[:20])
        return None
    except AgentTimeout as exc:
        _audit(
            case,
            "analysis.timeout",
            agent=agent_name,
            backend=_backend_label(),
            error=str(exc)[:200],
        )
        return None
    except AgentError as exc:
        _audit(
            case,
            "analysis.agent_failed",
            agent=agent_name,
            backend=_backend_label(),
            error=f"{type(exc).__name__}: {str(exc)[:200]}",
        )
        return None
    try:
        result = _record(case, kind, payload)
    except AnalysisConflict as exc:
        _audit(case, "analysis.skipped", agent=agent_name, reason=type(exc).__name__)
        return None
    except AnalysisApplyFailed as exc:
        _audit(case, "analysis.apply_failed", agent=agent_name, error=str(exc)[:200])
        return None
    if not result.valid:
        _audit(
            case,
            "analysis.agent_output_invalid",
            agent=agent_name,
            agent_run_id=result.agent_run.pk,
            errors=len(result.validation_errors),
        )
        return None
    return payload


def _stored_risk_analysis(case):
    """A valid risk analysis already stored for this round (a re-run after a failed planner)."""
    run = (
        AgentRun.objects.filter(
            risk_case=case, agent="RISK_ANALYST", round=case.analysis_round, valid=True
        )
        .order_by("-pk")
        .first()
    )
    return run.raw if run else None


def run_analysis_for_case(case: RiskCase, *, feedback: str = "") -> bool:
    """True when the recovery plan was recorded (case moved on). Never raises."""
    try:
        case = RiskCase.objects.select_related("tenant", "event").get(pk=case.pk)
        if case.status != RiskCase.Status.ANALYZING:
            return False
        total = conf_float("AGENT_TOTAL_TIMEOUT_SECONDS", DEFAULT_TOTAL_TIMEOUT)
        _audit(
            case,
            "analysis.started",
            backend=_backend_label(),
            round=case.analysis_round,
            budget_seconds=total,
        )
        with deadline(total):
            risk = _stored_risk_analysis(case)
            if risk is None:
                risk = _step(
                    case,
                    RISK_ANALYSIS,
                    "RISK_ANALYST",
                    lambda: run_risk_analyst(case, feedback=feedback),
                )
            if risk is None:
                return False
            case.refresh_from_db()
            plan = _step(
                case,
                RECOVERY_PLAN,
                "RECOVERY_PLANNER",
                lambda: run_recovery_planner(case, risk, feedback=feedback),
            )
        if plan is None:
            return False
        case.refresh_from_db()
        _audit(case, "analysis.completed", backend=_backend_label(), status=case.status)
        return True
    except Exception as exc:  # last resort: never crash the caller (thread, command, on_commit)
        logger.exception("analysis crashed for %s", getattr(case, "pk", case))
        try:
            _audit(case, "analysis.crashed", error=f"{type(exc).__name__}: {str(exc)[:200]}")
        except Exception:
            pass
        return False


class AgentAnalysisTrigger:
    """AnalysisTrigger: hand the request to the runner (thread, or inline with AGENT_RUN_SYNC)."""

    def request_analysis(self, request) -> None:
        from apps.workflow.hooks import StubAnalysisTrigger

        from . import runner

        try:
            enabled = backend_name() != "none"
        except AgentError:
            logger.error("AGENT_BACKEND is invalid; analysis not started")
            enabled = False  # the stub only logs + audits the request
        if not enabled:
            StubAnalysisTrigger().request_analysis(request)
            return
        runner.submit(request)
