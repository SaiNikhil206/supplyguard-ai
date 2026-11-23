"""Test-only urlconf: the real routes plus two read endpoints built on TenantScopedViewSet
(the real RiskCase / Supplier endpoints belong to other tasks)."""
from django.urls import path
from rest_framework import mixins, serializers
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsTenantUser
from apps.core.models import RiskCase, Supplier
from apps.core.tenancy import TenantScopedViewSet
from config.urls import urlpatterns as real_urlpatterns


class _IdSerializer(serializers.Serializer):
    id = serializers.CharField()
    tenant_id = serializers.CharField()


class RiskCaseViewSet(
    TenantScopedViewSet, mixins.RetrieveModelMixin, mixins.ListModelMixin
):
    queryset = RiskCase.objects.all().order_by("id")
    serializer_class = _IdSerializer
    permission_classes = [IsTenantUser]


class SupplierViewSet(
    TenantScopedViewSet, mixins.RetrieveModelMixin, mixins.ListModelMixin
):
    queryset = Supplier.objects.all().order_by("id")
    serializer_class = _IdSerializer
    permission_classes = [IsTenantUser]


class AnyAuthRiskCaseViewSet(RiskCaseViewSet):
    """Accepts any authenticated caller incl. SYSTEM (to exercise the mixin with an API key)."""

    permission_classes = [IsAuthenticated]


urlpatterns = [
    path("test/any/risk-cases/<str:pk>", AnyAuthRiskCaseViewSet.as_view({"get": "retrieve"})),
    path("test/risk-cases", RiskCaseViewSet.as_view({"get": "list"})),
    path("test/risk-cases/<str:pk>", RiskCaseViewSet.as_view({"get": "retrieve"})),
    path("test/suppliers", SupplierViewSet.as_view({"get": "list"})),
    path("test/suppliers/<str:pk>", SupplierViewSet.as_view({"get": "retrieve"})),
    *real_urlpatterns,
]
