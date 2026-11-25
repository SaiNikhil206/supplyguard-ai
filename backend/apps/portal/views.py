"""Read-only portal APIs (docs/CONTRACTS.md s4). Tenant comes from the credential only."""

from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Prefetch, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import RolePermission
from apps.audit.models import AuditEvent
from apps.core.models import (
    Approval,
    DisruptionEvent,
    PurchaseOrder,
    RiskCase,
    Shipment,
    Supplier,
)
from apps.core.tenancy import TenantScopedMixin, TenantScopedViewSet

from .serializers import (
    RiskCaseDetailSerializer,
    RiskCaseListSerializer,
    SupplierDetailSerializer,
    SupplierSerializer,
    money,
)

TAG = ["portal"]
CLOSED_STATES = ("RECOVERED", "CLOSED", "REJECTED")
TREND_DAYS = 30


class PortalPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 100


def _choice(params, name, choices):
    value = params.get(name)
    if not value:
        return None
    if value not in choices:
        raise ValidationError({name: [f"Must be one of: {', '.join(choices)}."]})
    return value


def _moment(name, raw):
    value = None
    try:
        value = parse_datetime(raw)
        if value is None:
            day = parse_date(raw)
            if day is not None:
                value = datetime.combine(day, time.min)
    except ValueError:
        value = None
    if value is None:
        raise ValidationError({name: ["Enter an ISO 8601 date or datetime."]})
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value


@extend_schema_view(
    list=extend_schema(
        tags=TAG,
        parameters=[
            OpenApiParameter("status", str),
            OpenApiParameter("risk_level", str),
            OpenApiParameter("search", str, description="Name or id contains."),
        ],
        responses=SupplierSerializer(many=True),
    ),
    retrieve=extend_schema(tags=TAG, responses=SupplierDetailSerializer),
)
class SupplierViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    pagination_class = PortalPagination
    permission_classes = [RolePermission]
    permission_key = "suppliers.read"
    lookup_field = "erp_id"

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
            .order_by("erp_id")
        )
        if self.action != "list":
            return qs
        params = self.request.query_params
        status = _choice(params, "status", Supplier.Status.values)
        risk = _choice(params, "risk_level", Supplier.RiskLevel.values)
        if status:
            qs = qs.filter(status=status)
        if risk:
            qs = qs.filter(risk_level=risk)
        term = params.get("search", "").strip()
        if term:
            qs = qs.filter(Q(name__icontains=term) | Q(erp_id__icontains=term))
        return qs

    def retrieve(self, request, *args, **kwargs):
        supplier = self.get_object()
        tenant = self.get_request_tenant()
        pos = PurchaseOrder.objects.filter(tenant=tenant, supplier=supplier)
        lead = pos.aggregate(avg=Avg(F("expected_date") - F("order_date")))["avg"]
        events_qs = DisruptionEvent.objects.filter(tenant=tenant, supplier=supplier)
        since = timezone.now() - timedelta(days=365)
        kpis = {
            "avg_lead_time_days": None if lead is None else round(lead.total_seconds() / 86400, 1),
            "open_po_value": pos.filter(status=PurchaseOrder.Status.OPEN).aggregate(
                s=Sum("amount")
            )["s"]
            or Decimal("0"),
            "disruptions_last_12m": events_qs.filter(event_time__gte=since).count(),
        }
        events = list(events_qs.select_related("risk_case").order_by("-event_time", "-id")[:50])
        ctx = {
            **self.get_serializer_context(),
            "kpis": kpis,
            "events": events,
            "currency": tenant.currency,
        }
        return Response(SupplierDetailSerializer(supplier, context=ctx).data)


@extend_schema_view(
    list=extend_schema(
        tags=TAG,
        parameters=[
            OpenApiParameter("status", str),
            OpenApiParameter("severity", str),
            OpenApiParameter("from", str, description="Created at or after (ISO, UTC)."),
            OpenApiParameter("to", str, description="Created before (ISO, UTC)."),
        ],
        responses=RiskCaseListSerializer(many=True),
    ),
    retrieve=extend_schema(tags=TAG, responses=RiskCaseDetailSerializer),
)
class RiskCaseViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = RiskCase.objects.all()
    serializer_class = RiskCaseListSerializer
    pagination_class = PortalPagination
    permission_classes = [RolePermission]
    permission_key = "risk-cases.read"

    def get_serializer_class(self):
        return RiskCaseDetailSerializer if self.action == "retrieve" else RiskCaseListSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related("event", "supplier")
        if self.action == "retrieve":
            approvals = Approval.objects.select_related("decided_by", "execution").order_by(
                "decided_at", "id"
            )
            return qs.prefetch_related(
                "affected_pos",
                "agent_runs",
                "recommendations",
                Prefetch("approvals", queryset=approvals),
            )
        qs = qs.annotate(affected_po_count=Count("affected_pos__po_id", distinct=True)).order_by(
            "-created_at", "-id"
        )
        params = self.request.query_params
        status = _choice(params, "status", RiskCase.Status.values)
        severity = _choice(params, "severity", DisruptionEvent.Severity.values)
        if status:
            qs = qs.filter(status=status)
        if severity:
            qs = qs.filter(risk_level=severity)
        if params.get("from"):
            qs = qs.filter(created_at__gte=_moment("from", params["from"]))
        if params.get("to"):
            qs = qs.filter(created_at__lt=_moment("to", params["to"]))
        return qs

    def retrieve(self, request, *args, **kwargs):
        case = self.get_object()
        case.affected_po_count = len({a.po_id for a in case.affected_pos.all()})
        timeline = list(
            AuditEvent.objects.filter(tenant=self.get_request_tenant())
            .filter(
                Q(correlation_id=case.correlation_id) | Q(entity_type="RiskCase", entity_id=case.id)
            )
            .order_by("timestamp", "id")[:200]
        )
        ctx = {**self.get_serializer_context(), "timeline": timeline}
        return Response(RiskCaseDetailSerializer(case, context=ctx).data)


@extend_schema(tags=TAG, responses=dict)
class DashboardSummaryView(TenantScopedMixin, APIView):
    permission_classes = [RolePermission]
    permission_key = "dashboard.read"

    def get(self, request):
        tenant = self.get_request_tenant()
        cur = tenant.currency
        cases = RiskCase.objects.filter(tenant=tenant)
        open_cases = cases.exclude(status__in=CLOSED_STATES)
        today = timezone.now().date()
        days = [today - timedelta(days=i) for i in range(TREND_DAYS - 1, -1, -1)]
        per_day = {
            r["day"]: r
            for r in cases.filter(created_at__date__gte=days[0])
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(n=Count("id"), exposure=Sum("exposure_amount"))
        }
        zero = Decimal("0")
        return Response(
            {
                "suppliers": Supplier.objects.filter(tenant=tenant).count(),
                "open_pos": PurchaseOrder.objects.filter(
                    tenant=tenant, status=PurchaseOrder.Status.OPEN
                ).count(),
                "active_shipments": Shipment.objects.filter(
                    tenant=tenant, status=Shipment.Status.IN_TRANSIT
                ).count(),
                "exposure": money(open_cases.aggregate(s=Sum("exposure_amount"))["s"] or zero, cur),
                "open_cases": open_cases.count(),
                "recovered_value": money(
                    cases.filter(status="RECOVERED").aggregate(s=Sum("exposure_amount"))["s"]
                    or zero,
                    cur,
                ),
                "exposure_trend": [
                    {"date": d.isoformat(), "value": float(per_day.get(d, {}).get("exposure") or 0)}
                    for d in days
                ],
                "cases_trend": [
                    {"date": d.isoformat(), "value": per_day.get(d, {}).get("n", 0)} for d in days
                ],
            }
        )
