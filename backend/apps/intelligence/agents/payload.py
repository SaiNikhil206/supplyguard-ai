"""Agent input built from the stored case (the shape ai/eval/payload.py produces).

`case.snapshot` + `case.impact` are exactly what N-07 fact-checks the output against, so the
agents must see these, not a recomputation.
"""

import json
from decimal import Decimal

from apps.intelligence.services import _event_dict

RISK_ANALYST = "RISK_ANALYST"
RECOVERY_PLANNER = "RECOVERY_PLANNER"


def _constraints(tenant) -> dict:
    settings_ = getattr(tenant, "settings", None) or {}
    out = {}
    for key, default in (("max_cost_increase_pct", None), ("require_qualified_alternates", True)):
        value = settings_.get(key, default)
        if value is not None:
            out[key] = value
    return out


def _plain(value):
    """Stored JSON can hold Decimal numbers; the wire format needs plain int / float."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON serializable")


def build_agent_input(case, agent: str, risk_analysis: dict | None = None) -> dict:
    snapshot = dict(case.snapshot or {})
    snapshot.setdefault(
        "supplier_history", (snapshot.get("supplier") or {}).get("disruption_history", [])
    )
    event = _event_dict(case.event)
    payload = {
        "agent": agent,
        "risk_case_id": case.id,
        "tenant_id": case.tenant_id,
        "correlation_id": str(case.correlation_id),
        "event": event,
        "snapshot": snapshot,
        "impact": case.impact,
        "data_quality_flags": list(case.data_quality_flags or []),
    }
    if agent == RECOVERY_PLANNER:
        if risk_analysis is None:
            raise ValueError("RECOVERY_PLANNER input needs the risk_analysis")
        payload["risk_analysis"] = risk_analysis
        payload["constraints"] = _constraints(case.tenant)
    return json.loads(json.dumps(payload, default=_plain))
