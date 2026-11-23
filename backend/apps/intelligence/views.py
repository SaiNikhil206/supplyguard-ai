"""N-11 what-if endpoints (docs/CONTRACTS.md s4). Read-only apart from one audit row per call."""
from decimal import Decimal

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import RolePermission
from apps.audit import record
from apps.core.models import RiskCase
from apps.core.tenancy import TenantScopedMixin

from . import whatif
from .serializers import CaseWhatIfRequestSerializer, WhatIfRequestSerializer


class DownstreamError(APIException):
    status_code = 502
    default_detail = "The ERP could not be read."


class DownstreamTimeout(APIException):
    status_code = 504
    default_detail = "The ERP did not answer in time."


def _client():
    return whatif.make_http_client(
        settings.ERP_BASE_URL, settings.ERP_API_KEY, settings.ERP_TIMEOUT_SECONDS
    )


def _simulate(request, tenant, *, supplier_id, event_type, hours, severity, extra, notes):
    cid = getattr(request, "correlation_id", None)
    event = whatif.build_event(
        tenant_id=tenant.id,
        supplier_id=supplier_id,
        event_type=event_type,
        duration_hours=hours,
        severity=severity,
    )
    client = _client()
    try:
        snapshot = whatif.fetch_snapshot(client, supplier_id, tenant.id, cid)
    except whatif.ErpNotFound:
        raise NotFound() from None
    except whatif.ErpTimeout:
        raise DownstreamTimeout() from None
    except whatif.ErpUnavailable:
        raise DownstreamError() from None
    finally:
        close = getattr(client, "close", None)
        if close:
            close()
    if (snapshot["supplier"] or {}).get("tenant_id") not in (None, tenant.id):
        raise NotFound()  # defence in depth: an ERP that ignored X-Tenant-ID
    return whatif.run_what_if(
        tenant={"tenant_id": tenant.id, "currency": tenant.currency, "settings": tenant.settings},
        event=event,
        snapshot=snapshot,
        scenario_extra=extra,
        assumptions_extra=notes,
    )


def _audit(request, tenant, entity, body):
    record(
        request.user,
        "what_if.run",
        entity,
        tenant=tenant,
        data={
            "supplier_id": body["scenario"]["supplier_id"],
            "event_type": body["scenario"]["event_type"],
            "duration_days": body["scenario"]["duration_days"],
            "risk_case_id": body["scenario"].get("risk_case_id"),
            "risk_score": body["risk"]["score"],
            "risk_level": body["risk"]["level"],
            "affected_po_count": len({p["po_id"] for p in body["affected_pos"]}),
            "exposure": body["exposure"],
        },
    )


@extend_schema(
    request=WhatIfRequestSerializer, responses={200: dict}, summary="What-if supplier outage"
)
class WhatIfView(generics.GenericAPIView):
    permission_classes = [RolePermission]
    permission_key = "what-if"
    serializer_class = WhatIfRequestSerializer
    pagination_class = None

    def post(self, request):
        tenant = request.tenant  # JWT / API key; never the body
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        body = _simulate(
            request,
            tenant,
            supplier_id=v["supplier_id"],
            event_type=v["event_type"],
            hours=Decimal(v["duration_days"]) * 24,
            severity=None,
            extra={"risk_case_id": None, "source": "REQUEST"},
            notes=[],
        )
        _audit(request, tenant, ("Supplier", v["supplier_id"]), body)
        return Response(body)


@extend_schema(
    request=CaseWhatIfRequestSerializer,
    responses={200: dict},
    summary="What-if on an existing risk case",
)
class CaseWhatIfView(TenantScopedMixin, generics.GenericAPIView):
    permission_classes = [RolePermission]
    permission_key = "what-if"
    serializer_class = CaseWhatIfRequestSerializer
    pagination_class = None
    queryset = RiskCase.objects.select_related("event", "supplier")
    lookup_field = "id"
    lookup_url_kwarg = "case_id"

    def post(self, request, case_id):
        case = self.get_object()  # tenant-scoped: foreign or missing -> 404
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        override = data.validated_data.get("duration_days")
        event = case.event
        notes = [f"Seeded from risk case {case.id}: supplier, event type and severity copied."]
        if override is not None:
            hours = Decimal(override) * 24
            notes.append(f"Duration overridden to {override} days.")
        elif event.expected_duration_hours:
            hours = Decimal(event.expected_duration_hours)
            notes.append("Duration taken from the case's event.")
        else:
            raise ValidationError(
                {"duration_days": ["The case has no expected duration; supply duration_days."]}
            )
        body = _simulate(
            request,
            request.tenant,
            supplier_id=event.supplier_erp_id,
            event_type=event.event_type,
            hours=hours,
            severity=event.severity,
            extra={"risk_case_id": case.id, "source": "RISK_CASE"},
            notes=notes,
        )
        _audit(request, request.tenant, case, body)
        return Response(body)
