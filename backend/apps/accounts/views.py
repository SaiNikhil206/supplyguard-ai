from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenViewBase

from .permissions import IsTenantUser
from .serializers import MeSerializer, TokenObtainSerializer, TokenRefreshSerializer


class _Throttled:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    permission_classes = [AllowAny]


@extend_schema(summary="Log in: returns access and refresh tokens", auth=[])
class TokenObtainView(_Throttled, TokenObtainPairView):
    serializer_class = TokenObtainSerializer


@extend_schema(summary="Exchange a refresh token for a new access token", auth=[])
class TokenRefreshView(_Throttled, TokenViewBase):
    serializer_class = TokenRefreshSerializer


@extend_schema(summary="The signed-in user and tenant")
class MeView(generics.RetrieveAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsTenantUser]
    pagination_class = None

    def get_object(self):
        return self.request.user
