"""Agent runner (N-09): the Risk Analyst and Recovery Planner behind one interface.

    run_risk_analyst(case) -> dict
    run_recovery_planner(case, risk_analysis) -> dict

`AGENT_BACKEND=boomi|claude|mock` (env or Django setting) picks the backend on every call; unset
means `none`: nothing is run and the trigger is the stub. All three return the agent JSON
(schemas in ai/schemas/); validating and storing it is `services.record_analysis`, driven by
`orchestrator.run_analysis_for_case`.
"""

from importlib import import_module

from .config import (  # noqa: F401
    AgentConfigError,
    AgentError,
    AgentOutputError,
    AgentTimeout,
    backend_name,
)


def _backend():
    if backend_name() == "none":
        raise AgentConfigError("AGENT_BACKEND is not set (none): no agent output is produced")
    return import_module(f"{__name__}.{backend_name()}")


def run_risk_analyst(case, *, feedback: str = "") -> dict:
    return _backend().run_risk_analyst(case, feedback=feedback)


def run_recovery_planner(case, risk_analysis: dict, *, feedback: str = "") -> dict:
    return _backend().run_recovery_planner(case, risk_analysis, feedback=feedback)
