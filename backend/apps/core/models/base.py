from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .sequences import next_id

_MISSING = object()


class TenantOwned(models.Model):
    """Abstract base for every tenant-owned row (docs/CONTRACTS.md s10).

    Same-tenant guard: `save()` checks that every FK target that has a `tenant_id` (including
    `Approval.decided_by`, a User) carries the same tenant as the row, and raises
    `ValidationError` otherwise. Child models set `tenant_parent = "<fk name>"`; when `tenant`
    is not given it is copied from that parent. `bulk_create` and `QuerySet.update` skip this
    guard, so callers using them must check the tenant themselves.

    Models with a generated string pk set `id_prefix` / `id_width`; the id comes from
    `next_id()` on first save.
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    tenant_parent: str | None = None
    id_prefix: str | None = None
    id_width: int = 6

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.check_same_tenant()
        if self.id_prefix and not self.pk:
            self.pk = next_id(self.id_prefix, self.id_width)
        super().save(*args, **kwargs)

    def _fk_targets(self):
        for field in self._meta.concrete_fields:
            if field.many_to_one or field.one_to_one:
                if field.name == "tenant":
                    continue
                target = getattr(self, field.name)
                if target is not None:
                    yield field.name, target

    def check_same_tenant(self):
        if self.tenant_id is None and self.tenant_parent:
            parent = getattr(self, self.tenant_parent, None)
            if parent is not None:
                self.tenant_id = parent.tenant_id
        if self.tenant_id is None:
            raise ValidationError(f"{self._meta.label}: tenant is required.")
        for name, target in self._fk_targets():
            target_tenant = getattr(target, "tenant_id", _MISSING)
            if target_tenant is _MISSING:
                continue
            if target_tenant != self.tenant_id:
                raise ValidationError(
                    f"{self._meta.label}.{name} belongs to another tenant "
                    f"({target_tenant!r} != {self.tenant_id!r})."
                )
