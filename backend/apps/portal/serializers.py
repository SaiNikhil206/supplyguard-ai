"""Response shapes for the read APIs. Field names follow frontend/src/api/types.ts.

Money is `{"amount": "<decimal string>", "currency": "XXX"}` (docs/CONTRACTS.md s1). Where the
models hold no data for a TS field the field is left out, never invented (see R-02 notes).
"""

from rest_framework import serializers

from apps.accounts.ids import format_user_id


def money(amount, currency):
    if amount is None:
        return None
    return {"amount": f"{amount:.2f}", "currency": currency}


def _num(value):
    return None if value is None else float(value)


class SupplierSerializer(serializers.Serializer):
    """List item. Needs the `open_po_count` annotation from the view."""

    id = serializers.CharField(source="erp_id")
    name = serializers.CharField()
    country = serializers.CharField()
    category = serializers.CharField()
    status = serializers.CharField()
    risk_level = serializers.CharField()
    open_po_count = serializers.IntegerField()
    on_time_delivery_pct = serializers.FloatField()


class SupplierDetailSerializer(SupplierSerializer):
    """Profile + KPIs + disruption history. The view sets `kpis` and `disruption_history`."""

    contact_email = serializers.CharField()
    city = serializers.CharField()
    kpis = serializers.SerializerMethodField()
    disruption_history = serializers.SerializerMethodField()

    def get_kpis(self, obj) -> dict:
        return obj.kpis

    def get_disruption_history(self, obj) -> list:
        history = []
        for event in obj.history_events:
            case = getattr(event, "risk_case", None)  # reverse one-to-one, select_related
            history.append(
                {
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                    "severity": event.severity,
                    "event_time": event.event_time,
                    "description": event.description,
                    "risk_case_id": case.pk if case is not None else None,
                }
            )
        return history


class RiskCaseListSerializer(serializers.Serializer):
    """List item. Needs the `affected_po_count` annotation and select_related event/supplier."""

    id = serializers.CharField()
    status = serializers.CharField()
    severity = serializers.CharField(source="risk_level")
    supplier_id = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()
    event_type = serializers.CharField(source="event.event_type")
    title = serializers.CharField()
    risk_score = serializers.IntegerField()
    affected_po_count = serializers.IntegerField()
    exposure = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()

    def get_supplier_id(self, obj) -> str:
        return obj.supplier.erp_id if obj.supplier_id else obj.event.supplier_erp_id

    def get_supplier_name(self, obj) -> str | None:
        return obj.supplier.name if obj.supplier_id else None

    def get_exposure(self, obj) -> dict:
        return money(obj.exposure_amount, obj.currency)


def serialize_event(event):
    return {
        "event_id": event.event_id,
        "tenant_id": event.tenant_id,
        "supplier_id": event.supplier_erp_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "event_time": event.event_time,
        "expected_duration_hours": _num(event.expected_duration_hours),
        "description": event.description,
        "source_system": event.source_system,
        "correlation_id": str(event.correlation_id),
    }


def serialize_affected_po(row):
    return {
        "po_id": row.po_id,
        "item_id": row.item_id,
        "item_name": row.item_name,
        "qty": row.affected_qty,
        "value": money(row.exposure_amount, row.currency),
        "due_date": row.due_date,
        "days_late_estimate": _num(row.estimated_delay_days),
        "stock_cover_days": _num(row.inventory_coverage_days),  # null = unknown
        "shortage": row.shortage,
    }


def serialize_recommendation(rec):
    return {
        "id": rec.pk,
        "round": rec.round,
        "rank": rec.rank,
        "option_type": rec.option_type,
        "proposed_action": rec.proposed_action,
        "action_steps": rec.action_steps,
        "estimated_lead_time_days": _num(rec.estimated_lead_time_days),
        "estimated_cost_delta": money(rec.estimated_cost_delta, rec.currency),
        "trade_offs": rec.trade_offs,
        "evidence": rec.evidence,
        "assumptions": rec.assumptions,
        "data_gaps": rec.data_gaps,
        "status": rec.status,
        "unsupported": rec.unsupported,
        "unsupported_reasons": rec.unsupported_reasons,
    }


def serialize_approval(approval):
    return {
        "id": approval.pk,
        "recommendation_id": approval.recommendation_id,
        "round": approval.round,
        "decision": approval.decision,
        "comments": approval.comments,
        "decided_by": format_user_id(approval.decided_by_id),
        "decided_at": approval.decided_at,
    }


def serialize_execution(execution, approval):
    return {
        "id": execution.pk,
        "approval_id": approval.pk,
        "recommendation_id": approval.recommendation_id,
        "status": execution.status,
        "started_at": execution.started_at,  # null until the run starts
        "finished_at": execution.finished_at,
        "error": execution.error,
        "retryable": execution.retryable,
    }


_DETAIL_KEYS = ("reason", "comments", "description", "message")


def serialize_timeline_entry(audit):
    data = audit.data if isinstance(audit.data, dict) else {}
    detail = ""
    for key in _DETAIL_KEYS:
        value = data.get(key)
        if isinstance(value, str) and value:
            detail = value[:300]
            break
    if data.get("from") and data.get("to"):
        detail = f"{data['from']} -> {data['to']}" + (f": {detail}" if detail else "")
    return {
        "at": audit.timestamp,
        "actor": audit.actor,
        "action": audit.action,
        "detail": detail,
    }
