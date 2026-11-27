"""`mock` backend: committed fixtures for offline demos, no network.

The v1.3.0 reference answers were produced against the eval harness's provisional impact numbers,
so they are re-aligned to THIS case before they are returned: `risk_case_id`, the engine's
risk_score / risk_level, IMPACT and EVENT evidence values (and the same numbers inside the prose).
Anything without a fixture gets a deterministic minimal valid output.
"""

import copy
import json
import re
from functools import lru_cache

from .config import repo_path

# supplier -> reference answers. SUP-1008 = demo (and TC-06/07/08); SUP-1040 = TC-05 (no option).
_FIXTURES = {
    "SUP-1008": "demo.json",
    "SUP-1040": "tc05.json",
}
_BANDS = ((85, "CRITICAL"), (65, "HIGH"), (40, "MEDIUM"), (0, "LOW"))


def _level(score: int) -> str:
    return next(name for floor, name in _BANDS if score >= floor)


@lru_cache(maxsize=8)
def _load(agent_dir: str, name: str, root: str) -> dict:
    path = (
        repo_path("AGENT_FIXTURE_DIR", "boomi", "agents") / agent_dir / "eval" / "reference" / name
    )
    return json.loads(path.read_text(encoding="utf-8"))


def _fixture(agent_dir: str, supplier_id: str):
    name = _FIXTURES.get(supplier_id)
    if not name:
        return None
    root = str(repo_path("AGENT_FIXTURE_DIR", "boomi", "agents"))
    try:
        return copy.deepcopy(_load(agent_dir, name, root))
    except OSError:
        return None


def _replace_in_texts(node, old: str, new: str):
    pattern = re.compile(rf"(?<![\w.]){re.escape(old)}(?![\w.])")
    if isinstance(node, str):
        return pattern.sub(new, node)
    if isinstance(node, list):
        return [_replace_in_texts(x, old, new) for x in node]
    if isinstance(node, dict):
        return {
            k: (v if k in ("source", "entity", "field") else _replace_in_texts(v, old, new))
            for k, v in node.items()
        }
    return node


def _impact_value(impact: dict, entity: str, field: str):
    if entity == "IMPACT":
        value = impact.get(field)
    else:
        value = next(
            (p.get(field) for p in impact.get("affected_pos", []) if p["po_id"] == entity), None
        )
    return value["amount"] if isinstance(value, dict) and "amount" in value else value


def _align_risk_analysis(out: dict, case) -> dict:
    impact, event = case.impact, case.event
    old_score, new_score = out.get("risk_score"), impact["risk_score"]
    out["risk_case_id"], out["risk_score"], out["risk_level"] = (
        case.id,
        new_score,
        _level(new_score),
    )
    old_event_ids = set()
    for ev in out["evidence"]:
        if ev["source"] == "IMPACT":
            new = _impact_value(impact, ev["entity"], ev["field"])
            if new is not None and new != ev["value"]:
                for key in ("summary", "facts", "estimates"):
                    out[key] = _replace_in_texts(out[key], str(ev["value"]), str(new))
                ev["value"] = new
        elif ev["source"] == "EVENT":
            old_event_ids.add(ev["entity"])
            ev["entity"] = event.event_id
    for old in old_event_ids - {event.event_id}:
        for key in ("summary", "facts", "estimates", "missing_data"):
            out[key] = _replace_in_texts(out[key], old, event.event_id)
    if old_score is not None and old_score != new_score:
        out["summary"] = _replace_in_texts(out["summary"], str(old_score), str(new_score))
    return out


def _minimal_risk_analysis(case) -> dict:
    impact = case.impact
    pos = [p["po_id"] for p in impact.get("affected_pos", [])]
    score = impact["risk_score"]
    entities = [{"type": "SUPPLIER", "id": case.event.supplier_erp_id}]
    entities += [{"type": "PO", "id": po} for po in pos]
    return {
        "risk_case_id": case.id,
        "risk_level": _level(score),
        "risk_score": score,
        "summary": (
            f"Disruption {case.event.event_id} at supplier {case.event.supplier_erp_id} affects "
            f"{len(pos)} purchase order(s). Offline mock analysis: no AI model was called."
        ),
        "affected_entities": entities,
        "evidence": [
            {"source": "IMPACT", "entity": "IMPACT", "field": "risk_score", "value": score}
        ],
        "facts": [],
        "estimates": [],
        "assumptions": ["This output is a deterministic offline placeholder."],
        "missing_data": [
            *(case.data_quality_flags or []),
            "No AI analysis was performed (mock backend).",
        ],
        "confidence": "LOW",
    }


def run_risk_analyst(case, **_) -> dict:
    out = _fixture("risk_analyst", case.event.supplier_erp_id)
    return _align_risk_analysis(out, case) if out else _minimal_risk_analysis(case)


def run_recovery_planner(case, risk_analysis, **_) -> dict:
    out = _fixture("recovery_planner", case.event.supplier_erp_id)
    if out is None:
        return {
            "risk_case_id": case.id,
            "options": [],
            "no_viable_option_reason": "Offline mock backend has no recovery plan for this "
            "scenario; no option is supported by the data.",
        }
    out["risk_case_id"] = case.id
    event_id = case.event.event_id
    old = set()
    for option in out["options"]:
        for ev in option.get("evidence", []):
            if ev.get("source") == "EVENT":
                old.add(ev["entity"])
                ev["entity"] = event_id
    for evt in old - {event_id}:
        out = _replace_in_texts(out, evt, event_id)
    return out
