import uuid
from datetime import UTC, datetime, time

from django.utils.dateparse import parse_date, parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission

from apps.tenants.models import Tenant

from .models import AuditEvent
from .serializers import AuditEventSerializer


class HasActiveTenant(BasePermission):
    """Authenticated user that belongs to an ACTIVE tenant.

    PLACEHOLDER for U-04's role permission matrix (docs/CONTRACTS.md s2): until it lands, any
    authenticated user with a tenant may read their own tenant's audit log. Unauthenticated
    requests fall through to DRF's 401.
    """

    message = "No active tenant for this user."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        tenant = getattr(user, "tenant", None)
        return tenant is not None and tenant.status == Tenant.Status.ACTIVE


def _parse_moment(name: str, raw: str) -> datetime:
    """ISO date (midnight UTC) or datetime (naive = UTC) -> aware UTC datetime."""
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
    return value.astimezone(UTC)


_PARAMS = [
    OpenApiParameter("entity_type", str, description="Exact entity type, e.g. RiskCase."),
    OpenApiParameter("action", str, description="Exact action name."),
    OpenApiParameter("correlation_id", str, description="UUID of the request/flow."),
    OpenApiParameter("from", str, description="Inclusive lower bound (ISO date/datetime, UTC)."),
    OpenApiParameter("to", str, description="Exclusive upper bound (ISO date/datetime, UTC)."),
]


@extend_schema_view(
    get=extend_schema(parameters=_PARAMS, summary="List audit events (tenant-scoped)")
)
class AuditEventList(generics.ListAPIView):
    """Read-only, newest first. The tenant comes only from the authenticated user."""

    serializer_class = AuditEventSerializer
    permission_classes = [HasActiveTenant]

    def get_queryset(self):
        # Never read a tenant from query/body. Null-tenant rows can never match this filter.
        qs = AuditEvent.objects.filter(tenant=self.request.user.tenant)
        params = self.request.query_params
        if params.get("entity_type"):
            qs = qs.filter(entity_type=params["entity_type"])
        if params.get("action"):
            qs = qs.filter(action=params["action"])
        if params.get("correlation_id"):
            try:
                cid = uuid.UUID(params["correlation_id"])
            except ValueError:
                raise ValidationError({"correlation_id": ["Enter a valid UUID."]}) from None
            qs = qs.filter(correlation_id=cid)
        if params.get("from"):
            qs = qs.filter(timestamp__gte=_parse_moment("from", params["from"]))
        if params.get("to"):
            qs = qs.filter(timestamp__lt=_parse_moment("to", params["to"]))
        return qs.order_by("-timestamp", "-id")
