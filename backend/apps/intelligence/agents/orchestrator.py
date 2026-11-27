"""Run both agents for one case and store the results (N-09).

`run_analysis_for_case(case)` -> risk analyst -> record_analysis(RISK_ANALYSIS) -> recovery
planner -> record_analysis(RECOVERY_PLAN, round=case.analysis_round). Synchronous and safe from
`transaction.on_commit`: it never raises. A failed agent call or an invalid output is audited
and the case stays ANALYZING (N-10: ANALYZING -> CLOSED is the manual way out).

`AgentAnalysisTrigger` is the real `AnalysisTrigger` (WORKFLOW_ANALYSIS_TRIGGER).
"""

import logging

from apps.core.models import RiskCase
from apps.intelligence.exceptions import AnalysisApplyFailed, AnalysisConflict
from apps.intelligence.services import record_analysis
from apps.intelligence.validation import RECOVERY_PLAN, RISK_ANALYSIS

from . import AgentError, AgentOutputError, run_recovery_planner, run_risk_analyst
from .config import backend_name

logger = logging.getLogger(__name__)
SYSTEM = "SYSTEM"
RAW_LIMIT = 20000


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
        payload = call()
    except AgentOutputError as exc:  # answered, but not JSON: keep it as an invalid AgentRun
        payload = {"unparseable_output": (exc.raw or "")[:RAW_LIMIT], "error": str(exc)[:200]}
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


def run_analysis_for_case(case: RiskCase, *, feedback: str = "") -> bool:
    """True when the recovery plan was recorded (case moved on). Never raises."""
    try:
        case = RiskCase.objects.select_related("tenant", "event").get(pk=case.pk)
        if case.status != RiskCase.Status.ANALYZING:
            return False
        risk = _step(
            case, RISK_ANALYSIS, "RISK_ANALYST", lambda: run_risk_analyst(case, feedback=feedback)
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
        return plan is not None
    except Exception as exc:  # last resort: never crash the caller (on_commit, request)
        logger.exception("analysis crashed for %s", getattr(case, "pk", case))
        try:
            _audit(case, "analysis.crashed", error=f"{type(exc).__name__}: {str(exc)[:200]}")
        except Exception:
            pass
        return False


class AgentAnalysisTrigger:
    """AnalysisTrigger: run the agents synchronously for the requested round."""

    def request_analysis(self, request) -> None:
        case = RiskCase.objects.filter(pk=request.risk_case_id, tenant_id=request.tenant_id).first()
        if case is None or case.analysis_round != request.round:
            return
        run_analysis_for_case(case, feedback=request.feedback or "")
