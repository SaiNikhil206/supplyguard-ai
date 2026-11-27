"""Agent runner (N-09): the Risk Analyst and Recovery Planner behind one interface.

    run_risk_analyst(case) -> dict
    run_recovery_planner(case, risk_analysis) -> dict

`AGENT_BACKEND=boomi|claude|mock` (env or Django setting, default `mock`) picks the backend on
every call. All three return the agent JSON (schemas in ai/schemas/); validating and storing it is
`apps.intelligence.services.record_analysis`, driven by `orchestrator.run_analysis_for_case`.
"""

from importlib import import_module

from .config import (  # noqa: F401
    AgentConfigError,
    AgentError,
    AgentOutputError,
    backend_name,
)


def _backend():
    return import_module(f"{__name__}.{backend_name()}")


def run_risk_analyst(case, *, feedback: str = "") -> dict:
    return _backend().run_risk_analyst(case, feedback=feedback)


def run_recovery_planner(case, risk_analysis: dict, *, feedback: str = "") -> dict:
    return _backend().run_recovery_planner(case, risk_analysis, feedback=feedback)
