"""Risk case creation from a Boomi snapshot (POST /internal/risk-cases; tasks/UDAY.md U-06).

Order (each step is a security or idempotency rule):
  a. event lookup filtered by the credential's tenant; another tenant's event = the same 404 as
     an unknown id, plus an audit row in the CALLER's tenant
  b. event flagged for data correction -> 409, no case
  c. a case already exists for the event -> 200 with it, nothing recomputed
  d. snapshot.supplier null -> flag the event, no case
  e. compute with the pure impact engine (bad snapshot -> 400, never echoed)
  f. one transaction: RiskCase + AffectedPO rows + RECEIVED -> ANALYZING via
     apps.workflow.services.transition() + audit; a lost race is answered as (c)
The case is created in the model default status (RECEIVED) and moved only by transition().
"""
import json
import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.audit import record
from apps.core.models import AffectedPO, DisruptionEvent, RiskCase
from apps.intelligence.impact import SnapshotError, compute_impact, thresholds_from_tenant

from .services import _iso_utc, _json_number

logger = logging.getLogger(__name__)

CROSS_TENANT_ACTION = "security.cross_tenant_denied"


class Conflict(APIException):
    status_code = 409
    default_detail = "Conflict."
    default_code = "conflict"


@dataclass(frozen=True)
class CaseResult:
    http_status: int
    body: dict


def _json_safe(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder, allow_nan=False))


def _money_str(value) -> str:
    return str(Decimal(value).quantize(Decimal("0.01")))


def case_body(case: RiskCase, affected_po_count: int | None = None) -> dict:
    if affected_po_count is None:
        affected_po_count = case.affected_pos.count()
    return {
        "risk_case_id": case.id,
        "status": case.status,
        "risk_level": case.risk_level,
        "risk_score": case.risk_score,
        "exposure": {"amount": _money_str(case.exposure_amount), "currency": case.currency},
        "affected_po_count": affected_po_count,
        "data_quality_flags": list(case.data_quality_flags or []),
        "correlation_id": str(case.correlation_id),
    }


def move_to_analyzing(case: RiskCase, event: DisruptionEvent, actor) -> None:
    """RECEIVED -> ANALYZING (Trigger SYS_IMPACT) through the workflow state machine."""
    from apps.workflow.services import transition

    transition(
        case,
        RiskCase.Status.ANALYZING,
        actor=actor,
        reason="impact computed",
        correlation_id=event.correlation_id,
    )


def _heal(case: RiskCase, event: DisruptionEvent, actor) -> RiskCase:
    """An existing case still in RECEIVED (the move failed earlier) is moved on now; transition
    is idempotent for a case that is already ANALYZING."""
    if case.status == RiskCase.Status.RECEIVED:
        move_to_analyzing(case, event, actor)
    return case


def _find_event(tenant, event_id) -> DisruptionEvent:
    event = DisruptionEvent.objects.filter(tenant=tenant, event_id=event_id).first()
    if event is not None:
        return event
    if DisruptionEvent.objects.filter(event_id=event_id).exclude(tenant=tenant).exists():
        record(
            "SYSTEM",
            CROSS_TENANT_ACTION,
            ("DisruptionEvent", str(event_id)[:100]),
            tenant=tenant,
            data={"endpoint": "internal.risk-cases"},
        )
    raise NotFound()  # identical for "unknown" and "another tenant's"


def _event_dict(event: DisruptionEvent, tenant) -> dict:
    return {
        "event_id": event.event_id,
        "tenant_id": tenant.id,
        "supplier_id": event.supplier_erp_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "event_time": _iso_utc(event.event_time),
        "expected_duration_hours": _json_number(event.expected_duration_hours),
        "po_id": event.po_id or None,
    }


def _item_name(snapshot, po_id, item_id) -> str:
    for po in snapshot.get("purchase_orders") or []:
        if isinstance(po, dict) and po.get("po_id") == po_id:
            for line in po.get("lines") or []:
                if isinstance(line, dict) and line.get("item_id") == item_id and line.get(
                    "item_name"
                ):
                    return str(line["item_name"])[:200]
    for row in snapshot.get("inventory") or []:
        if isinstance(row, dict) and row.get("item_id") == item_id and row.get("item_name"):
            return str(row["item_name"])[:200]
    return ""


def _decimal(value, what):
    try:
        return None if value is None else Decimal(str(value))
    except InvalidOperation:
        raise ValidationError({"snapshot": [f"invalid number for {what}"]}) from None


def compute(tenant, event, snapshot) -> dict:
    """Run the impact engine; SnapshotError / ValueError -> 400 with the message only."""
    thresholds_input = {"settings": tenant.settings or {}, "currency": tenant.currency}
    try:
        thresholds = thresholds_from_tenant(thresholds_input)
        return compute_impact(_event_dict(event, tenant), snapshot, thresholds)
    except (SnapshotError, ValueError, KeyError, TypeError, AttributeError, ArithmeticError) as exc:
        message = str(exc) if isinstance(exc, ValueError) else "snapshot has an invalid structure"
        raise ValidationError({"snapshot": [message]}) from None


def create_risk_case_from_snapshot(
    tenant, event_id, snapshot, captured_at, actor="SYSTEM"
) -> CaseResult:
    event = _find_event(tenant, event_id)  # (a)

    if event.needs_data_correction:  # (b)
        raise Conflict("event is flagged for data correction")

    existing = RiskCase.objects.filter(tenant=tenant, event=event).first()  # (c)
    if existing is not None:
        return CaseResult(200, case_body(_heal(existing, event, actor)))

    if snapshot.get("supplier") is None:  # (d)
        DisruptionEvent.objects.filter(pk=event.pk).update(needs_data_correction=True)
        record(
            actor,
            "event.flagged_data_correction",
            ("DisruptionEvent", event.event_id),
            correlation_id=event.correlation_id,
            tenant=tenant,
            data={"reason": "supplier_not_in_snapshot"},
        )
        return CaseResult(200, {"risk_case_id": None, "flagged": True})

    result = compute(tenant, event, snapshot)  # (e)
    impact = _json_safe(result)
    rows = impact["affected_pos"]
    exposure = impact["total_exposure"]
    flags = impact["data_quality_flags"]
    supplier_name = (snapshot.get("supplier") or {}).get("name") or event.supplier_erp_id
    level, score = impact["risk_level"], impact["risk_score"]

    try:  # (f)
        with transaction.atomic():
            case = RiskCase.objects.create(
                tenant=tenant,
                event=event,
                supplier=event.supplier,
                risk_level=level,
                risk_score=score,
                title=f"{event.event_type} at {supplier_name}"[:300],
                impact_summary=(
                    f"{len(impact['affected_po_ids'])} POs affected, exposure "
                    f"{exposure['amount']} {exposure['currency']}, risk {level} ({score})"
                ),
                exposure_amount=_decimal(exposure["amount"], "exposure"),
                currency=exposure["currency"],
                analysis_round=1,
                snapshot=snapshot,
                snapshot_captured_at=captured_at,
                impact=impact,
                data_quality_flags=flags,
                correlation_id=event.correlation_id,
            )
            for row in rows:
                AffectedPO.objects.create(
                    tenant=tenant,
                    risk_case=case,
                    po_id=row["po_id"],
                    item_id=row["item_id"],
                    item_name=_item_name(snapshot, row["po_id"], row["item_id"]),
                    affected_qty=row["affected_qty"],
                    estimated_delay_days=_decimal(row["estimated_delay_days"], "delay"),
                    exposure_amount=_decimal(row["exposure_amount"]["amount"], "exposure"),
                    currency=row["exposure_amount"]["currency"],
                    due_date=date.fromisoformat(row["due_date"]),
                    inventory_coverage_days=_decimal(row["inventory_coverage_days"], "coverage"),
                    shortage=bool(row["shortage"]),
                )
            move_to_analyzing(case, event, actor)
            record(
                actor,
                "risk_case.created",
                case,
                correlation_id=event.correlation_id,
                tenant=tenant,
                data={
                    "risk_level": level,
                    "risk_score": score,
                    "affected_po_count": len(rows),
                },
            )
    except IntegrityError:
        winner = RiskCase.objects.filter(tenant=tenant, event=event).first()
        if winner is None:
            raise
        return CaseResult(200, case_body(_heal(winner, event, actor)))
    return CaseResult(201, case_body(case, len(rows)))
