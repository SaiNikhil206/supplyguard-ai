"""Agent input built from the stored case, in exactly the shape `ai/eval/payload.py` produces and
`ai/schemas/agent_input.schema.json` allows (strict top level, event and impact).

`case.snapshot` + `case.impact` are what N-07 fact-checks the output against, so the agents see
those, not a recomputation. Keys the schema forbids (extra impact keys such as affected_po_ids,
due_date / line_nos inside affected_pos, snapshot.shipments) and nulls (event.shipment_id) are
dropped. The result is validated against the schema before every call; a failure raises
`AgentInputInvalid` and the agent is not called.
"""

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from apps.intelligence.services import _event_dict
from apps.intelligence.validation import _schema_dir

from .config import AgentError

RISK_ANALYST = "RISK_ANALYST"
RECOVERY_PLANNER = "RECOVERY_PLANNER"

_SNAPSHOT_KEYS = (
    "captured_at",
    "supplier",
    "supplier_history",
    "purchase_orders",
    "inventory",
    "alternate_suppliers",
)
_PO_KEYS = (
    "po_id",
    "item_id",
    "affected_qty",
    "estimated_delay_days",
    "exposure_amount",
    "inventory_coverage_days",
    "shortage",
)
_CONSTRAINT_KEYS = ("max_cost_increase_pct", "require_qualified_alternates", "priority_items")
_SCHEMA_FILES = ("common", "agent_input", "risk_analysis", "recovery_plan")


class AgentInputInvalid(AgentError):
    """The built input does not match agent_input.schema.json; `errors` has the paths."""

    def __init__(self, errors: list[dict]):
        super().__init__(
            f"agent input does not match agent_input.schema.json ({len(errors)} errors)"
        )
        self.errors = errors


def _plain(value):
    """Stored JSON can hold Decimal numbers; the wire format needs plain int / float."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"{type(value).__name__} is not JSON serializable")


def _constraints(tenant) -> dict:
    settings_ = getattr(tenant, "settings", None) or {}
    return {k: settings_[k] for k in _CONSTRAINT_KEYS if settings_.get(k) is not None}


def _snapshot(case) -> dict:
    stored = case.snapshot or {}
    out = {k: stored[k] for k in _SNAPSHOT_KEYS if k in stored}
    out.setdefault("supplier_history", (stored.get("supplier") or {}).get("disruption_history", []))
    return out


def _impact(case) -> dict:
    stored = case.impact or {}
    out = {k: stored[k] for k in ("risk_score", "total_exposure") if k in stored}
    out["affected_pos"] = [
        {k: row[k] for k in _PO_KEYS if k in row} for row in stored.get("affected_pos", [])
    ]
    return out


@lru_cache(maxsize=4)
def _validator(folder: str):
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource

    docs = {
        n: json.loads((Path(folder) / f"{n}.schema.json").read_text(encoding="utf-8"))
        for n in _SCHEMA_FILES
    }
    registry = Registry().with_resources(
        [(d["$id"], Resource.from_contents(d)) for d in docs.values()]
    )
    return Draft202012Validator(docs["agent_input"], registry=registry)


def validate_input(payload: dict) -> list[dict]:
    validator = _validator(str(_schema_dir()))
    return [
        {"path": ".".join(map(str, e.absolute_path)) or "$", "message": e.message[:300]}
        for e in sorted(
            validator.iter_errors(payload), key=lambda e: list(map(str, e.absolute_path))
        )
    ]


def build_agent_input(case, agent: str, risk_analysis: dict | None = None) -> dict:
    if agent == RECOVERY_PLANNER and risk_analysis is None:
        raise ValueError("RECOVERY_PLANNER input needs the risk_analysis")
    payload = {
        "agent": agent,
        "risk_case_id": case.id,
        "tenant_id": case.tenant_id,
        "correlation_id": str(case.correlation_id),
        "event": {k: v for k, v in _event_dict(case.event).items() if v is not None},
        "snapshot": _snapshot(case),
        "impact": _impact(case),
        "data_quality_flags": list(case.data_quality_flags or []),
    }
    if agent == RECOVERY_PLANNER:
        payload["risk_analysis"] = risk_analysis
        payload["constraints"] = _constraints(case.tenant)
    payload = json.loads(json.dumps(payload, default=_plain))
    errors = validate_input(payload)
    if errors:
        raise AgentInputInvalid(errors)
    return payload
