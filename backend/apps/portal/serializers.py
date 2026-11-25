"""Read-only serializers for the portal UI APIs (shapes follow frontend/src/api/types.ts).

Fields with no backing data are omitted, never invented: Supplier.risk_score and
SupplierKpis.quality_pass_pct (the model only has a 0-5 quality_score).
"""

from rest_framework import serializers


def money(amount, currency):
    return {"amount": f"{amount:.2f}", "currency": currency}


def num(value):
    return None if value is None else float(value)


class SupplierSerializer(serializers.Serializer):
    id = serializers.CharField(source="erp_id")
    name = serializers.CharField()
    country = serializers.CharField()
    category = serializers.CharField()
    status = serializers.CharField()
    risk_level = serializers.CharField()
    open_po_count = serializers.IntegerField()
    on_time_delivery_pct = serializers.FloatField()


class SupplierDetailSerializer(SupplierSerializer):
    contact_email = serializers.CharField()
    kpis = serializers.SerializerMethodField()
    disruption_history = serializers.SerializerMethodField()

    def get_kpis(self, obj) -> dict:
        k = self.context["kpis"]
        return {
            "on_time_delivery_pct": float(obj.on_time_delivery_pct),
            "avg_lead_time_days": k["avg_lead_time_days"],
            "open_po_value": money(k["open_po_value"], self.context["currency"]),
            "disruptions_last_12m": k["disruptions_last_12m"],
        }

    def get_disruption_history(self, obj) -> list:
        out = []
        for e in self.context["events"]:
            case = getattr(e, "risk_case", None)  # reverse one-to-one, may not exist
            out.append(
                {
                    "event_id": e.event_id,
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "event_time": e.event_time,
                    "description": e.description,
                    "risk_case_id": case.id if case else None,
                }
            )
        return out


class RiskCaseListSerializer(serializers.Serializer):
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
        return obj.supplier.erp_id if obj.supplier else obj.event.supplier_erp_id

    def get_supplier_name(self, obj) -> str | None:
        return obj.supplier.name if obj.supplier else None

    def get_exposure(self, obj) -> dict:
        return money(obj.exposure_amount, obj.currency)


class RiskCaseDetailSerializer(RiskCaseListSerializer):
    event = serializers.SerializerMethodField()
    affected_pos = serializers.SerializerMethodField()
    analysis = serializers.SerializerMethodField()
    recommendations = serializers.SerializerMethodField()
    no_viable_option_reason = serializers.CharField(allow_null=True)
    approvals = serializers.SerializerMethodField()
    executions = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()

    def get_event(self, obj) -> dict:
        e = obj.event
        return {
            "event_id": e.event_id,
            "tenant_id": e.tenant_id,
            "supplier_id": e.supplier_erp_id,
            "event_type": e.event_type,
            "severity": e.severity,
            "event_time": e.event_time,
            "expected_duration_hours": num(e.expected_duration_hours),
            "description": e.description,
            "source_system": e.source_system,
            "correlation_id": str(e.correlation_id),
        }

    def get_affected_pos(self, obj) -> list:
        return [
            {
                "po_id": a.po_id,
                "item_id": a.item_id,
                "item_name": a.item_name,
                "qty": a.affected_qty,
                "value": money(a.exposure_amount, a.currency),
                "due_date": a.due_date,
                "days_late_estimate": num(a.estimated_delay_days),
                "stock_cover_days": num(a.inventory_coverage_days),
                "shortage": a.shortage,
            }
            for a in obj.affected_pos.all()
        ]

    def get_analysis(self, obj) -> dict | None:
        # Latest valid Risk Analyst run (its raw output was schema-validated before storing).
        runs = [r for r in obj.agent_runs.all() if r.agent == "RISK_ANALYST" and r.valid]
        if not runs:
            return None
        return max(runs, key=lambda r: (r.created_at, r.id)).raw

    def get_recommendations(self, obj) -> list:
        return [
            {
                "id": r.id,
                "round": r.round,
                "rank": r.rank,
                "option_type": r.option_type,
                "status": r.status,
                "unsupported": r.unsupported,
                "proposed_action": r.proposed_action,
                "action_steps": r.action_steps,
                "estimated_lead_time_days": num(r.estimated_lead_time_days),
                "estimated_cost_delta": (
                    None
                    if r.estimated_cost_delta is None
                    else money(r.estimated_cost_delta, r.currency)
                ),
                "trade_offs": r.trade_offs,
                "evidence": r.evidence,
                "assumptions": r.assumptions,
                "data_gaps": r.data_gaps,
            }
            for r in obj.recommendations.all()
        ]

    def get_approvals(self, obj) -> list:
        return [
            {
                "id": a.id,
                "recommendation_id": a.recommendation_id,
                "decision": a.decision,
                "comments": a.comments,
                "decided_by": a.decided_by.username,
                "decided_at": a.decided_at,
            }
            for a in obj.approvals.all()
        ]

    def get_executions(self, obj) -> list:
        out = []
        for a in obj.approvals.all():
            x = getattr(a, "execution", None)  # reverse one-to-one, may not exist
            if x is None:
                continue
            out.append(
                {
                    "id": x.id,
                    "recommendation_id": a.recommendation_id,
                    "status": x.status,
                    "started_at": x.started_at,
                    "finished_at": x.finished_at,
                    "error": x.error,
                    "retryable": x.retryable,
                }
            )
        return out

    def get_timeline(self, obj) -> list:
        out = []
        for t in self.context["timeline"]:
            data = t.data or {}
            out.append(
                {
                    "at": t.timestamp,
                    "actor": t.actor,
                    "action": t.action,
                    "detail": str(data.get("detail") or data.get("message") or ""),
                }
            )
        return out
