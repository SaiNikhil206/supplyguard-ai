"""Authentication classes. The database is the source of truth, never the token's claims."""
import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Tenant

from .apikeys import hash_key, key_prefix, looks_well_formed
from .models import ApiKey
from .principals import SystemPrincipal

logger = logging.getLogger(__name__)

LAST_USED_INTERVAL = timedelta(minutes=1)


class TenantJWTAuthentication(JWTAuthentication):
    """Standard JWT validation, then: the token's tenant_id/role claims must equal the user's
    current DB values (a stale or forged token is a 401) and the user must be active.
    Sets `request.tenant` from the user. An INACTIVE tenant is rejected by permissions."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        if not user.is_active:
            raise AuthenticationFailed("User is inactive.", code="user_inactive")
        claim_tenant, claim_role = token.get("tenant_id"), token.get("role")
        if (
            not claim_tenant
            or not claim_role
            or user.tenant_id is None
            or claim_tenant != user.tenant_id
            or claim_role != user.role
        ):
            raise AuthenticationFailed("Token is no longer valid.", code="token_stale")
        request._request.tenant = user.tenant
        return user, token


class ApiKeyAuthentication(BaseAuthentication):
    """`X-Api-Key: sgk_...` for SYSTEM callers. No header -> None (other authenticators run)."""

    header_meta = "HTTP_X_API_KEY"

    def authenticate(self, request):
        raw = request.META.get(self.header_meta)
        if not raw:
            return None
        key = ApiKey.objects.select_related("tenant").filter(key_hash=hash_key(raw)).first()
        if key is None or not key.is_active or key.tenant.status != Tenant.Status.ACTIVE:
            self._audit_rejected(raw)
            raise AuthenticationFailed("Invalid API key.", code="invalid_api_key")
        self._touch(key)
        request._request.tenant = key.tenant
        return SystemPrincipal(key), key

    def authenticate_header(self, request):
        return "ApiKey"

    @staticmethod
    def _touch(key):
        now = timezone.now()
        if key.last_used_at is None or now - key.last_used_at >= LAST_USED_INTERVAL:
            ApiKey.objects.filter(pk=key.pk).update(last_used_at=now)
            key.last_used_at = now

    @staticmethod
    def _audit_rejected(raw):
        # Only the prefix of a well-formed key is recorded, never the key itself.
        prefix = key_prefix(raw) if looks_well_formed(raw) else None
        try:
            from apps.audit import record

            record(
                "SYSTEM",
                "security.api_key_rejected",
                ("ApiKey", prefix or "malformed"),
                data={"prefix": prefix} if prefix else {},
            )
        except Exception:
            logger.exception("audit write failed for security.api_key_rejected")
