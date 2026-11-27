"""Re-run the agents for cases stuck in ANALYZING (a worker died, a backend call failed).

A case is stuck when it is ANALYZING, was last updated more than --older-than seconds ago and has
no valid RECOVERY_PLANNER AgentRun for its current round. A stored valid risk analysis is reused.
Runs inline, one case at a time, under the same total deadline as a normal run.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import AgentRun, RiskCase
from apps.intelligence.agents.config import AgentError, backend_name
from apps.intelligence.agents.orchestrator import run_analysis_for_case


def stuck_cases(older_than: int):
    cutoff = timezone.now() - timedelta(seconds=older_than)
    done = AgentRun.objects.filter(agent="RECOVERY_PLANNER", valid=True).values_list(
        "risk_case_id", "round"
    )
    done = set(done)
    return [
        c
        for c in RiskCase.objects.filter(status=RiskCase.Status.ANALYZING, updated_at__lte=cutoff)
        .select_related("tenant", "event")
        .order_by("updated_at")
        if (c.pk, c.analysis_round) not in done
    ]


class Command(BaseCommand):
    help = "Re-run the agents for cases stuck in ANALYZING."

    def add_arguments(self, parser):
        parser.add_argument("--older-than", type=int, default=300, help="seconds (default 300)")
        parser.add_argument("--limit", type=int, default=20)

    def handle(self, *args, **options):
        try:
            if backend_name() == "none":
                self.stdout.write("AGENT_BACKEND is not set: nothing to run")
                return
        except AgentError as exc:
            self.stderr.write(str(exc))
            return
        cases = stuck_cases(options["older_than"])[: options["limit"]]
        ok = sum(1 for case in cases if run_analysis_for_case(case))
        self.stdout.write(f"stuck: {len(cases)}, completed: {ok}")
