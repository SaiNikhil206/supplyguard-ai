from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DashboardSummaryView, RiskCaseViewSet, SupplierViewSet

router = SimpleRouter(trailing_slash=False)
router.register("suppliers", SupplierViewSet, basename="portal-supplier")
router.register("risk-cases", RiskCaseViewSet, basename="portal-risk-case")

urlpatterns = [
    path("dashboard/summary", DashboardSummaryView.as_view(), name="portal-dashboard-summary"),
    *router.urls,
]
