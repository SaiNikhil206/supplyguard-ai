"""Persist the impact engine's result (N-04, the "load" step after `compute_impact`).

`create_risk_case()` is called by `POST /internal/risk-cases` (Uday, U-06). It runs the pure
engine in `impact.py`, then writes one RiskCase and one AffectedPO per (po_id, item_id) in a
single transaction. It never sets or changes `RiskCase.status`: a new case keeps the model
default (RECEIVED) and later moves only through `apps.workflow.services.transition()`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

from django.db import IntegrityError, transaction

from apps.core.models import AffectedPO, DisruptionEvent, RiskCase

from .impact import TenantThresholds, compute_impact, rows, thresholds_from_tenant


class TenantMismatch(ValueError):
    """The event or the snapshot does not belong to the tenant the case is created for."""


def _utc_iso(dt: datetime) -> str:
    dt = dt.astimezone(UTC)
    frac = f".{dt.microsecond:06d}" if dt.microsecond else ""
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + frac + "Z"


def _event_dict(event: DisruptionEvent) -> dict:
    """The CONTRACTS s3 canonical event, as `compute_impact` reads it."""
    return {
        "event_id": event.event_id,
        "tenant_id": event.tenant_id,
        "supplier_id": event.supplier_erp_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "event_time": _utc_iso(event.event_time),
        "expected_duration_hours": event.expected_duration_hours,
        "description": event.description,
        "source_system": event.source_system,
        "correlation_id": str(event.correlation_id),
        "shipment_id": event.shipment_id,
        "po_id": event.po_id,
    }


def _check_snapshot_tenant(tenant_id: str, snapshot: dict) -> None:
    supplier = snapshot.get("supplier")
    candidates = [supplier] if supplier else []
    for key in ("purchase_orders", "inventory", "alternate_suppliers"):
        candidates += rows(snapshot.get(key))
    for row in candidates:
        tid = row.get("tenant_id")
        if tid is not None and tid != tenant_id:
            raise TenantMismatch(f"snapshot row belongs to tenant {tid}, case is for {tenant_id}")


def _captured_at(snapshot: dict) -> datetime | None:
    raw = snapshot.get("captured_at")
    if not raw:
        return None
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def _item_names(snapshot: dict) -> dict[str, str]:
    names: dict[str, str] = {}
    for po in rows(snapshot.get("purchase_orders")):
        for line in po.get("lines") or []:
            if line.get("item_name"):
                names.setdefault(line["item_id"], line["item_name"])
    for row in rows(snapshot.get("inventory")):
        if row.get("item_name"):
            names.setdefault(row["item_id"], row["item_name"])
    return names


def _summary(result: dict, supplier_label: str, event: DisruptionEvent) -> tuple[str, str]:
    n_po = len(result["affected_po_ids"])
    n_lines = len(result["affected_pos"])
    exposure = result["total_exposure"]
    title = f"{supplier_label}: {event.event_type} affects {n_po} open PO(s)"
    shortage = "shortage expected" if result["shortage"] else "no shortage expected"
    summary = (
        f"{event.event_type} at {supplier_label} ({event.event_id}) affects {n_po} open PO(s) "
        f"across {n_lines} PO line(s) and {len(result['affected_item_ids'])} item(s). "
        f"Exposure {exposure['currency']} {exposure['amount']}, "
        f"estimated delay up to {result['estimated_delay_days']} day(s), {shortage}. "
        f"Risk score {result['risk_score']} ({result['risk_level']})."
    )
    return title[:300], summary


def create_risk_case(
    *,
    tenant,
    event: DisruptionEvent,
    snapshot: dict,
    thresholds: TenantThresholds | None = None,
) -> RiskCase | None:
    """Run the impact engine and save RiskCase + AffectedPO rows.

    Returns the existing case unchanged if the event already has one (idempotent), None when
    the engine finds no affected PO line (nothing is written), else the new RiskCase.
    Raises TenantMismatch (nothing written) if the event or snapshot is another tenant's.
    """
    if event.tenant_id != tenant.id:
        raise TenantMismatch(f"event {event.event_id} belongs to tenant {event.tenant_id}")
    _check_snapshot_tenant(tenant.id, snapshot)

    existing = RiskCase.objects.filter(event=event).first()
    if existing is not None:
        return existing

    if thresholds is None:
        thresholds = thresholds_from_tenant(
            {"settings": tenant.settings, "currency": tenant.currency}
        )
    result = compute_impact(_event_dict(event), snapshot, thresholds)
    if not result["affected_pos"]:
        return None

    names = _item_names(snapshot)
    supplier_label = (snapshot.get("supplier") or {}).get("name") or event.supplier_erp_id
    title, summary = _summary(result, supplier_label, event)
    exposure = result["total_exposure"]

    try:
        with transaction.atomic():
            case = RiskCase.objects.create(
                tenant=tenant,
                event=event,
                supplier=event.supplier,
                risk_level=result["risk_level"],
                risk_score=result["risk_score"],
                title=title,
                impact_summary=summary,
                exposure_amount=Decimal(exposure["amount"]),
                currency=exposure["currency"],
                snapshot=snapshot,
                snapshot_captured_at=_captured_at(snapshot),
                impact=result,
                data_quality_flags=result["data_quality_flags"],
                correlation_id=event.correlation_id,
            )
            for row in result["affected_pos"]:
                cov = row["inventory_coverage_days"]
                AffectedPO.objects.create(
                    tenant=tenant,
                    risk_case=case,
                    po_id=row["po_id"],
                    item_id=row["item_id"],
                    item_name=names.get(row["item_id"], ""),
                    affected_qty=row["affected_qty"],
                    estimated_delay_days=Decimal(str(row["estimated_delay_days"])),
                    exposure_amount=Decimal(row["exposure_amount"]["amount"]),
                    currency=row["exposure_amount"]["currency"],
                    due_date=date.fromisoformat(row["due_date"]),
                    inventory_coverage_days=None if cov is None else Decimal(str(cov)),
                    shortage=row["shortage"],
                )
    except IntegrityError:
        # Lost a race with a concurrent call for the same event: return the winner's case.
        existing = RiskCase.objects.filter(event=event).first()
        if existing is None:
            raise
        return existing
    return case
