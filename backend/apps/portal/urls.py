from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DashboardSummaryView, RiskCaseViewSet, SupplierViewSet

router = SimpleRouter(trailing_slash=False)  # CONTRACTS s4 paths have no trailing slash
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("risk-cases", RiskCaseViewSet, basename="risk-case")

urlpatterns = [
    path("dashboard/summary", DashboardSummaryView.as_view(), name="dashboard-summary"),
    *router.urls,
]
