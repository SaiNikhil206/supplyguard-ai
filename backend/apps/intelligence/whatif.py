"""N-11 what-if simulator: a synthetic disruption run through the N-04 impact engine.

No database access and no Django request objects here: `fetch_snapshot` talks to the ERP over
HTTP (read-only), `run_what_if` is a pure function of (scenario, snapshot, tenant). The views
add auth, tenant scoping and the one audit row. Every number is an estimate (AC-03).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal

import httpx

from . import impact

logger = logging.getLogger(__name__)

EVENT_TYPES = (
    "FACTORY_OUTAGE",
    "SHIPMENT_DELAY",
    "QUALITY_HOLD",
    "CAPACITY_REDUCTION",
    "LOGISTICS_DISRUPTION",
)
MIN_DAYS, MAX_DAYS = 1, 90
DISCLAIMER = (
    "Simulation only: every figure below is an estimate computed on a fresh ERP snapshot. "
    "Nothing was saved or changed in the ERP."
)


class ErpError(Exception):
    """Base for ERP read failures."""


class ErpNotFound(ErpError):
    """The ERP has no such supplier for this tenant."""


class ErpTimeout(ErpError):
    pass


class ErpUnavailable(ErpError):
    pass


# --------------------------------------------------------------------------- ERP snapshot


def make_http_client(base_url: str, api_key: str, timeout: float) -> httpx.Client:
    headers = {"X-Api-Key": api_key} if api_key else {}
    return httpx.Client(base_url=base_url, headers=headers, timeout=timeout)


def _get(client, path: str, tenant_id: str, correlation_id: str | None, params=None):
    headers = {"X-Tenant-ID": tenant_id}
    if correlation_id:
        headers["X-Correlation-ID"] = correlation_id
    try:
        resp = client.get(path, params=params, headers=headers)
    except httpx.TimeoutException as exc:
        raise ErpTimeout("ERP did not answer in time") from exc
    except httpx.HTTPError as exc:
        raise ErpUnavailable("ERP is not reachable") from exc
    if resp.status_code == 404:
        raise ErpNotFound(path)
    if resp.status_code != 200:
        logger.warning("ERP %s answered %s", path, resp.status_code)
        raise ErpUnavailable(f"ERP answered {resp.status_code}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ErpUnavailable("ERP returned invalid JSON") from exc


def fetch_snapshot(client, supplier_id: str, tenant_id: str, correlation_id: str | None) -> dict:
    """Fresh read-only snapshot: supplier, its OPEN POs, inventory + alternates for their items."""
    supplier = _get(client, f"/erp/suppliers/{supplier_id}", tenant_id, correlation_id)
    pos = _get(
        client,
        "/erp/purchase-orders",
        tenant_id,
        correlation_id,
        {"supplier_id": supplier_id, "status": "OPEN"},
    )
    item_ids = sorted(
        {ln["item_id"] for po in impact.rows(pos) for ln in po.get("lines") or []}
    )
    inventory: list[dict] = []
    alternates: list[dict] = []
    for item in item_ids:
        inventory += impact.rows(
            _get(client, "/erp/inventory", tenant_id, correlation_id, {"item_id": item})
        )
        alternates += impact.rows(
            _get(client, "/erp/alternate-suppliers", tenant_id, correlation_id, {"item_id": item})
        )
    return {
        "supplier": supplier,
        "purchase_orders": impact.rows(pos),
        "inventory": inventory,
        "alternate_suppliers": alternates,
    }


# --------------------------------------------------------------------------- scenario


def severity_for(duration_hours: Decimal) -> str:
    """Deterministic severity for a typed scenario (no real event exists): longer = worse."""
    days = duration_hours / 24
    if days <= 3:
        return "MEDIUM"
    if days <= 14:
        return "HIGH"
    return "CRITICAL"


def build_event(
    *,
    tenant_id: str,
    supplier_id: str,
    event_type: str,
    duration_hours: Decimal,
    severity: str | None,
    now: datetime | None = None,
) -> dict:
    start = (now or datetime.now(UTC)).astimezone(UTC).replace(microsecond=0)
    return {
        "event_id": "WHATIF",
        "tenant_id": tenant_id,
        "supplier_id": supplier_id,
        "event_type": event_type,
        "severity": severity or severity_for(duration_hours),
        "event_time": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expected_duration_hours": float(duration_hours),
        "description": "What-if simulation (not a real event)",
        "source_system": "what-if",
    }


# --------------------------------------------------------------------------- best option


def _money(amount: Decimal, currency: str) -> dict:
    return impact.money(amount, currency)


def _avg_price(snapshot: dict, supplier_id: str, item_id: str) -> Decimal | None:
    total = Decimal(0)
    qty = 0
    for po in snapshot["purchase_orders"]:
        if po.get("supplier_id") != supplier_id or po.get("status") != "OPEN":
            continue
        for ln in po.get("lines") or []:
            if ln.get("item_id") == item_id and ln.get("unit_price"):
                q = ln.get("qty") or 0
                total += Decimal(str(ln["unit_price"]["amount"])) * q
                qty += q
    return total / qty if qty else None


def _item_option(item: dict, snapshot: dict, result: dict, t, supplier_id, currency) -> dict:
    item_id, qty = item["item_id"], item["affected_qty"]
    current = _avg_price(snapshot, supplier_id, item_id)
    candidates = []
    for c in impact._candidates(
        item_id, snapshot["alternate_suppliers"], t.require_qualified_alternates, supplier_id
    ):
        cap = c.get("capacity")
        if cap is not None and cap < qty:
            continue
        price = Decimal(str(c["unit_price"]["amount"]))
        delta = (price - current) * qty if current is not None else None
        candidates.append(
            {
                "option_type": "ALTERNATE_SUPPLIER",
                "supplier_id": c["supplier_id"],
                "qty": qty,
                "unit_price": _money(price, c["unit_price"].get("currency") or currency),
                "lead_time_days": c.get("lead_time_days"),
                "capacity_known": cap is not None,
                "estimated_cost_delta": _money(delta, currency) if delta is not None else None,
                "_sort": (price, c.get("lead_time_days") or 0, c["supplier_id"]),
            }
        )
    candidates.sort(key=lambda c: c["_sort"])
    best_alt = candidates[0] if candidates else None

    transfer = None
    for r in result["inventory_coverage"]:
        if r["item_id"] == item_id and (r["transfer_surplus_qty"] or 0) >= qty:
            transfer = {
                "option_type": "INVENTORY_TRANSFER",
                "from_location_id": r["location_id"],
                "qty": qty,
                "lead_time_days": None,
                "estimated_cost_delta": _money(Decimal(0), currency),
            }
            break  # coverage rows are sorted by location_id: deterministic

    if not item["shortage"] and item["min_coverage_days"] is not None:
        return {
            "item_id": item_id,
            "affected_qty": qty,
            "recommended": None,
            "note": "Existing stock covers the estimated outage; no action modelled.",
        }
    chosen = transfer or best_alt
    if chosen is None:
        return {
            "item_id": item_id,
            "affected_qty": qty,
            "recommended": None,
            "note": "No qualified alternate with enough capacity and no transferable stock.",
        }
    chosen = {k: v for k, v in chosen.items() if not k.startswith("_")}
    return {"item_id": item_id, "affected_qty": qty, "recommended": chosen, "note": None}


def best_option_estimate(result: dict, snapshot: dict, t, supplier_id: str) -> dict | None:
    if not result["items"]:
        return None
    currency = result["total_exposure"]["currency"]
    per_item = [
        _item_option(i, snapshot, result, t, supplier_id, currency) for i in result["items"]
    ]
    chosen = [p["recommended"] for p in per_item if p["recommended"]]
    deltas = [
        Decimal(c["estimated_cost_delta"]["amount"]) for c in chosen if c["estimated_cost_delta"]
    ]
    leads = [c["lead_time_days"] for c in chosen if c.get("lead_time_days") is not None]
    return {
        "is_estimate": True,
        "rule": (
            "Per item: stock transfer if a location has surplus above the outage need, else the "
            "cheapest qualified alternate whose capacity is enough or unknown."
        ),
        "items": per_item,
        "uncovered_item_ids": [p["item_id"] for p in per_item if p["note"] and not p["recommended"]
                               and "covers" not in p["note"]],
        "total_estimated_cost_delta": _money(sum(deltas, Decimal(0)), currency),
        "max_lead_time_days": max(leads) if leads else None,
    }


# --------------------------------------------------------------------------- orchestration


def run_what_if(
    *,
    tenant: dict,
    event: dict,
    snapshot: dict,
    scenario_extra: dict | None = None,
    assumptions_extra: list[str] | None = None,
) -> dict:
    """`tenant` = {"tenant_id", "currency", "settings"}; returns the API response body."""
    gaps: list[str] = []
    try:
        t = impact.thresholds_from_tenant(tenant)
    except (ValueError, TypeError, ArithmeticError):
        t = impact.TenantThresholds(currency=tenant.get("currency") or "INR")
        gaps.append("tenant risk settings invalid; default thresholds used")
    result = impact.compute_impact(event, snapshot, t)
    supplier_id = event["supplier_id"]
    supplier = snapshot.get("supplier") or {}

    window = result["window"]
    duration_hours = Decimal(str(event["expected_duration_hours"]))
    assumptions = [
        "Every figure is an ESTIMATE from a simulated disruption, not a real event.",
        f"The supplier is fully unable to deliver for {float(duration_hours / 24):g} days from "
        f"{window['start']}; event type {event['event_type']} does not change the maths.",
        "Open POs with a line due on or before the end of the outage are treated as late.",
        "Stock coverage = (on hand - reserved - safety stock) / daily demand per location.",
        f"Severity input to the risk score: {event['severity']}.",
        "Alternate supplier capacity and lead times are taken from the ERP as-is; "
        + ("only qualified alternates are used." if t.require_qualified_alternates
           else "unqualified alternates are allowed (tenant setting)."),
        "Inventory transfers are assumed free and instant (no cost or lead time modelled).",
        "Nothing was written to the ERP or saved as a risk case.",
    ]
    assumptions += assumptions_extra or []
    if not result["affected_pos"]:
        gaps.append("no open purchase order line falls inside the simulated outage window")
    gaps += result["data_quality_flags"]
    option = best_option_estimate(result, snapshot, t, supplier_id)
    if option:
        for item in option["items"]:
            rec = item["recommended"]
            if rec and rec["option_type"] == "ALTERNATE_SUPPLIER":
                if not rec["capacity_known"]:
                    gaps.append(
                        f"capacity unknown for recommended alternate {rec['supplier_id']} "
                        f"({item['item_id']})"
                    )
                if rec["estimated_cost_delta"] is None:
                    gaps.append(f"current unit price unknown for {item['item_id']}")
    gaps = list(dict.fromkeys(gaps))

    items = result["items"]
    return {
        "estimate": True,
        "disclaimer": DISCLAIMER,
        "labels": {
            k: "ESTIMATE"
            for k in ("affected_pos", "inventory", "exposure", "risk", "best_option_estimate")
        },
        "scenario": {
            "supplier_id": supplier_id,
            "supplier_name": supplier.get("name"),
            "event_type": event["event_type"],
            "severity": event["severity"],
            "duration_days": float(duration_hours / 24),
            "duration_hours": float(duration_hours),
            "start": window["start"],
            "end": window["end"],
            **(scenario_extra or {}),
        },
        "affected_pos": result["affected_pos"],
        "inventory": {
            "gaps": [i for i in items if i["shortage"]],
            "items": items,
            "coverage": result["inventory_coverage"],
        },
        "exposure": result["total_exposure"],
        "estimated_delay_days": result["estimated_delay_days"],
        "shortage": result["shortage"],
        "risk": {
            "score": result["risk_score"],
            "level": result["risk_level"],
            "components": result["score_components"],
        },
        "best_option_estimate": option,
        "assumptions": assumptions,
        "data_gaps": gaps,
    }
