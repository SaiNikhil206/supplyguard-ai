"""N-07 persistence errors. They are `WorkflowError`s, so the contract handler renders the
CONTRACTS s1 body and `error.details.reason` carries the code."""
from rest_framework import status

from apps.workflow.exceptions import WorkflowError


class AnalysisConflict(WorkflowError):
    """409: the case is not waiting for this output (wrong state, stale round, duplicate)."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"
    reason = "ANALYSIS_CONFLICT"

    def __init__(self, reason, message, **details):
        super().__init__(message, reason=reason, **details)


class AnalysisInvalid(WorkflowError):
    """422: the agent output failed validation. The AgentRun was still stored."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "business_rule"
    reason = "AGENT_OUTPUT_INVALID"

    def __init__(self, result):
        super().__init__(
            "The agent output failed validation and was not applied.",
            agent_run_id=result.agent_run.pk,
            valid=False,
            errors=result.validation_errors,
            case_status=result.status,
        )
