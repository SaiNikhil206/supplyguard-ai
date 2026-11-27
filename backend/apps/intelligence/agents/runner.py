"""Run an analysis off the request thread (N-09 review).

U-06's callback commits the case and returns; the agents (seconds to minutes with a real backend)
run in a daemon thread that owns its DB connection and closes it at the end. `AGENT_RUN_SYNC=1`
runs inline instead (tests; also fine for the instant mock backend). A run that dies with the
process is picked up again by `manage.py run_pending_analysis`.
"""

import logging
import threading

from django.db import connections

from .config import conf_bool

logger = logging.getLogger(__name__)


def run_job(request) -> None:
    """Load the case of an AnalysisRequest and run the analysis. Never raises."""
    from apps.core.models import RiskCase

    from .orchestrator import run_analysis_for_case

    case = RiskCase.objects.filter(pk=request.risk_case_id, tenant_id=request.tenant_id).first()
    if case is None or case.analysis_round != request.round:
        return
    run_analysis_for_case(case, feedback=request.feedback or "")


def _worker(request) -> None:
    try:
        run_job(request)
    except Exception:
        logger.exception("analysis worker crashed for %s", request.risk_case_id)
    finally:
        connections.close_all()  # this thread's own connections


def submit(request) -> threading.Thread | None:
    """Start the analysis; returns the thread (None when run synchronously)."""
    if conf_bool("AGENT_RUN_SYNC", False):
        run_job(request)
        return None
    thread = threading.Thread(
        target=_worker, args=(request,), name=f"analysis-{request.risk_case_id}", daemon=True
    )
    thread.start()
    return thread
