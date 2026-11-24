"""Extension points into other streams. Import-guarded so U-06 works before they exist."""
import logging

logger = logging.getLogger(__name__)


def on_execution_result(execution) -> None:
    """Tell the workflow service an execution reached a terminal state (N-10 moves the case
    to RECOVERED / EXECUTION_FAILED through transition(); this module never changes status)."""
    try:
        from apps.workflow.services import on_execution_result as handler
    except (ImportError, AttributeError):
        logger.info("workflow service not available; execution %s case not advanced", execution.pk)
        return
    handler(execution)
