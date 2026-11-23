from rest_framework.permissions import BasePermission

from apps.tenants.models import Tenant

from .principals import SystemPrincipal


class IsTenantUser(BasePermission):
    """A real (non-SYSTEM) user that belongs to an ACTIVE tenant.

    Extend by subclassing with `allowed_roles = {...}` (None = any role). The role matrix builds
    on this; SYSTEM callers and tenant-less superusers never pass.
    """

    message = "No active tenant for this user."
    allowed_roles: frozenset[str] | set[str] | None = None

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated) or isinstance(user, SystemPrincipal):
            return False
        tenant = getattr(user, "tenant", None)
        if tenant is None or tenant.status != Tenant.Status.ACTIVE:
            return False
        return self.allowed_roles is None or user.role in self.allowed_roles
