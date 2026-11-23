from django.urls import path

from .views import EventIntakeView, IntegrationStatusView, SimulateDisruptionView

urlpatterns = [
    path("events/disruptions", EventIntakeView.as_view(), name="events-disruptions"),
    path("demo/simulate-disruption", SimulateDisruptionView.as_view(), name="demo-simulate"),
    path("integrations/status", IntegrationStatusView.as_view(), name="integrations-status"),
]
