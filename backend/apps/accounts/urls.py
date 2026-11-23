from django.urls import path

from .views import MeView, TokenObtainView, TokenRefreshView

urlpatterns = [
    path("auth/token", TokenObtainView.as_view(), name="auth-token"),
    path("auth/refresh", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me", MeView.as_view(), name="me"),
]
