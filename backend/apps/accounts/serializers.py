import logging

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)

NO_ACCOUNT = "No active account found with the given credentials"


def _audit(*args, **kwargs):
    """An audit failure must never break the auth response."""
    try:
        from apps.audit import record

        record(*args, **kwargs)
    except Exception:
        logger.exception("audit write failed for %s", args[1] if len(args) > 1 else "?")


def can_sign_in(user) -> bool:
    return bool(
        user is not None
        and user.is_active
        and user.tenant_id
        and user.tenant.status == Tenant.Status.ACTIVE
    )


class TokenObtainSerializer(TokenObtainPairSerializer):
    """Login `{username, password}` -> `{access, refresh}` with tenant_id and role claims."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["tenant_id"] = user.tenant_id
        token["role"] = user.role
        return token

    def validate(self, attrs):
        username = str(attrs.get(self.username_field, ""))[:150]
        try:
            data = super().validate(attrs)  # wrong password / inactive -> AuthenticationFailed
            if not can_sign_in(self.user):  # no tenant (incl. superusers) or tenant not ACTIVE
                raise AuthenticationFailed(NO_ACCOUNT, "no_active_account")
        except AuthenticationFailed:
            _audit("anonymous", "auth.login_failed", ("User", ""), data={"username": username})
            raise AuthenticationFailed(NO_ACCOUNT, "no_active_account") from None
        _audit(self.user, "auth.login", self.user, data={"username": self.user.get_username()})
        return {"access": data["access"], "refresh": data["refresh"]}


class TokenRefreshSerializer(serializers.Serializer):
    """`{refresh}` -> `{access}`; claims are re-read from the DB. No rotation, no blacklist."""

    refresh = serializers.CharField(write_only=True)
    access = serializers.CharField(read_only=True)

    def validate(self, attrs):
        try:
            token = RefreshToken(attrs["refresh"])  # signature, expiry, token_type == refresh
            user_id = token[api_settings.USER_ID_CLAIM]
        except (TokenError, KeyError) as exc:
            raise InvalidToken(str(exc.args[0]) if exc.args else "Invalid token") from None
        user = get_user_model().objects.select_related("tenant").filter(pk=user_id).first()
        if not can_sign_in(user):
            raise AuthenticationFailed(NO_ACCOUNT, "no_active_account")
        return {"access": str(TokenObtainSerializer.get_token(user).access_token)}


class TenantSummarySerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()


class MeSerializer(serializers.Serializer):
    id = serializers.CharField(source="api_id")
    email = serializers.EmailField()
    name = serializers.CharField()
    role = serializers.CharField()
    tenant = TenantSummarySerializer()
