"""Read-only endpoints for the UI screens (docs/CONTRACTS.md s4, owner Roop).

Every view is tenant-scoped through `TenantScopedMixin` (tenant from the credential only; a row of
another tenant answers 404) and role-checked through `RolePermission` (`permission_key`).
"""

from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import RolePermission
from apps.audit.models import AuditEvent
from apps.core.models import (
    AgentRun,
    Approval,
    DisruptionEvent,
    PurchaseOrder,
    RiskCase,
    Shipment,
    Supplier,
)
from apps.core.tenancy import TenantScopedMixin

from . import serializers as s

TAGS = ["portal"]
TREND_DAYS = 30
HISTORY_LIMIT = 50
TIMELINE_LIMIT = 200
CLOSED_STATES = (RiskCase.Status.RECOVERED, RiskCase.Status.CLOSED)


class PortalPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def _choice(params, name, choices):
    value = params.get(name)
    if not value:
        return None
    if value not in choices:
        raise ValidationError({name: [f"Must be one of: {', '.join(sorted(choices))}."]})
    return value


def _moment(params, name, *, end=False):
    """ISO date or datetime (naive = UTC) -> aware UTC datetime; a bare `to` date is inclusive."""
    raw = params.get(name)
    if not raw:
        return None
    value = None
    try:
        day = parse_date(raw)  # first: parse_datetime also accepts a bare date
        if day is not None:
            value = datetime.combine(day, time.min)
            if end:
                value += timedelta(days=1)
        else:
            value = parse_datetime(raw)
    except ValueError:
        value = None
    if value is None:
        raise ValidationError({name: ["Enter an ISO 8601 date or datetime."]})
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


_SUPPLIER_PARAMS = [
    OpenApiParameter("status", str, enum=Supplier.Status.values),
    OpenApiParameter("risk_level", str, enum=Supplier.RiskLevel.values),
    OpenApiParameter("search", str, description="Matches name or supplier id."),
    OpenApiParameter("page", int),
    OpenApiParameter("page_size", int),
]


@extend_schema_view(
    list=extend_schema(tags=TAGS, parameters=_SUPPLIER_PARAMS, summary="List suppliers"),
    retrieve=extend_schema(
        tags=TAGS, responses=OpenApiTypes.OBJECT, summary="Supplier profile, KPIs and history"
    ),
)
class SupplierViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Supplier.objects.all()
    permission_classes = [RolePermission]
    permission_key = "suppliers.read"
    pagination_class = PortalPagination
    lookup_field = "erp_id"  # the API id is the ERP id (SUP-1008)
    lookup_value_regex = "[^/]+"
    serializer_class = s.SupplierSerializer

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .annotate(
                open_po_count=Count(
                    "purchase_orders",
                    filter=Q(purchase_orders__status=PurchaseOrder.Status.OPEN),
                )
            )
            .order_by("erp_id")  # an annotation drops Meta.ordering; keep pages stable
        )
        if self.action != "list":
            return qs
        params = self.request.query_params
        if status := _choice(params, "status", Supplier.Status.values):
            qs = qs.filter(status=status)
        if level := _choice(params, "risk_level", Supplier.RiskLevel.values):
            qs = qs.filter(risk_level=level)
        if search := params.get("search", "").strip():
            qs = qs.filter(Q(name__icontains=search) | Q(erp_id__icontains=search))
        return qs

    def retrieve(self, request, *args, **kwargs):
        supplier = self.get_object()
        tenant = self.get_request_tenant()
        pos = PurchaseOrder.objects.filter(tenant=tenant, supplier=supplier)
        open_pos = pos.filter(status=PurchaseOrder.Status.OPEN, currency=tenant.currency)
        lead = pos.aggregate(
            avg=Avg(
                ExpressionWrapper(
                    F("expected_date") - F("order_date"), output_field=DurationField()
                )
            )
        )["avg"]
        open_value = open_pos.aggregate(total=Sum("amount"))["total"] or Decimal("0")
        since = timezone.now() - timedelta(days=365)
        supplier.kpis = {
            "on_time_delivery_pct": float(supplier.on_time_delivery_pct),
            "quality_score": float(supplier.quality_score),  # 0-5 scale; no pass-% in the data
            "avg_lead_time_days": (
                round(lead.total_seconds() / 86400, 1) if lead is not None else None
            ),
            "open_po_value": s.money(open_value, tenant.currency),
            "disruptions_last_12m": DisruptionEvent.objects.filter(
                tenant=tenant, supplier=supplier, event_time__gte=since
            ).count(),
        }
        supplier.history_events = list(
            DisruptionEvent.objects.filter(tenant=tenant, supplier=supplier)
            .select_related("risk_case")
            .order_by("-event_time", "-id")[:HISTORY_LIMIT]
        )
        return Response(s.SupplierDetailSerializer(supplier).data)


class DashboardSummaryView(TenantScopedMixin, APIView):
    permission_classes = [RolePermission]
    permission_key = "dashboard.read"

    @extend_schema(tags=TAGS, responses=OpenApiTypes.OBJECT, summary="Executive Overview counts")
    def get(self, request):
        tenant = self.get_request_tenant()
        cur = tenant.currency
        cases = RiskCase.objects.filter(tenant=tenant)
        open_cases = cases.exclude(status__in=CLOSED_STATES)
        open_agg = open_cases.aggregate(n=Count("pk"), total=Sum("exposure_amount", default=0))
        recovered = cases.filter(status=RiskCase.Status.RECOVERED).aggregate(
            total=Sum("exposure_amount", default=0)
        )["total"]

        today = timezone.now().date()
        first = today - timedelta(days=TREND_DAYS - 1)
        start = datetime.combine(first, time.min, tzinfo=UTC)
        per_day = {}
        for created, exposure in cases.filter(created_at__gte=start).values_list(
            "created_at", "exposure_amount"
        ):
            bucket = per_day.setdefault(created.astimezone(UTC).date(), [0, Decimal("0")])
            bucket[0] += 1
            bucket[1] += exposure
        days = [first + timedelta(days=i) for i in range(TREND_DAYS)]
        return Response(
            {
                "suppliers": Supplier.objects.filter(tenant=tenant).count(),
                "open_pos": PurchaseOrder.objects.filter(
                    tenant=tenant, status=PurchaseOrder.Status.OPEN
                ).count(),
                "active_shipments": Shipment.objects.filter(
                    tenant=tenant, status=Shipment.Status.IN_TRANSIT
                ).count(),
                "exposure": s.money(open_agg["total"], cur),
                "open_cases": open_agg["n"],
                "recovered_value": s.money(recovered, cur),
                "exposure_trend": [
                    {"date": d.isoformat(), "value": float(per_day.get(d, (0, 0))[1])} for d in days
                ],
                "cases_trend": [
                    {"date": d.isoformat(), "value": per_day.get(d, (0, 0))[0]} for d in days
                ],
            }
        )


_CASE_PARAMS = [
    OpenApiParameter("status", str, enum=RiskCase.Status.values),
    OpenApiParameter("severity", str, enum=DisruptionEvent.Severity.values),
    OpenApiParameter("from", str, description="Created at or after (ISO date/datetime, UTC)."),
    OpenApiParameter("to", str, description="Created before (datetime) / through (date)."),
    OpenApiParameter("page", int),
    OpenApiParameter("page_size", int),
]


@extend_schema_view(
    list=extend_schema(tags=TAGS, parameters=_CASE_PARAMS, summary="List risk cases"),
    retrieve=extend_schema(
        tags=TAGS,
        responses=OpenApiTypes.OBJECT,
        summary="Risk case with event, POs, analysis, recommendations, approvals, executions, "
        "timeline",
    ),
)
class RiskCaseViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = RiskCase.objects.all()
    permission_classes = [RolePermission]
    permission_key = "risk-cases.read"
    pagination_class = PortalPagination
    lookup_value_regex = "[^/]+"
    serializer_class = s.RiskCaseListSerializer

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("event", "supplier")
            .annotate(affected_po_count=Count("affected_pos__po_id", distinct=True))
            .order_by("-created_at", "-id")
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                "affected_pos",
                "recommendations",
                Prefetch("approvals", queryset=Approval.objects.select_related("execution")),
                Prefetch(
                    "agent_runs",
                    queryset=AgentRun.objects.filter(
                        agent=AgentRun.Agent.RISK_ANALYST, valid=True
                    ).order_by("-round", "-created_at", "-id"),
                    to_attr="valid_analyst_runs",
                ),
            )
            return qs
        params = self.request.query_params
        if status := _choice(params, "status", RiskCase.Status.values):
            qs = qs.filter(status=status)
        if severity := _choice(params, "severity", DisruptionEvent.Severity.values):
            qs = qs.filter(risk_level=severity)
        if start := _moment(params, "from"):
            qs = qs.filter(created_at__gte=start)
        if end := _moment(params, "to", end=True):
            qs = qs.filter(created_at__lt=end)
        return qs

    def retrieve(self, request, *args, **kwargs):
        case = self.get_object()
        audit = (
            AuditEvent.objects.filter(tenant_id=case.tenant_id)
            .filter(
                Q(correlation_id=case.correlation_id) | Q(entity_type="RiskCase", entity_id=case.pk)
            )
            .order_by("timestamp", "id")[:TIMELINE_LIMIT]
        )
        approvals = list(case.approvals.all())  # newest first
        executions = [
            s.serialize_execution(a.execution, a) for a in approvals if hasattr(a, "execution")
        ]
        # The validated analysis stored on the case; else the newest valid analyst run.
        analysis = case.analysis or None
        if analysis is None and case.valid_analyst_runs:
            analysis = case.valid_analyst_runs[0].raw or None
        data = dict(s.RiskCaseListSerializer(case).data)
        data.update(
            event=s.serialize_event(case.event),
            affected_pos=[s.serialize_affected_po(r) for r in case.affected_pos.all()],
            analysis=analysis,
            recommendations=[s.serialize_recommendation(r) for r in case.recommendations.all()],
            no_viable_option_reason=case.no_viable_option_reason or None,
            approvals=[s.serialize_approval(a) for a in approvals],
            executions=executions,
            timeline=[s.serialize_timeline_entry(a) for a in audit],
        )
        return Response(data)
