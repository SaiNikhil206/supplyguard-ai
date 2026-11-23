"""`record()`: the single way application code writes to the audit log (docs/CONTRACTS.md s10)."""
import json
import uuid

from django.core.serializers.json import DjangoJSONEncoder

from apps.accounts.ids import format_user_id
from apps.accounts.models import User
from apps.tenants.models import Tenant

from .context import get_correlation_id
from .models import AuditEvent

REDACTED = "[REDACTED]"
_SENSITIVE_PARTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "credential",
    "private_key",
)


def _is_sensitive(key) -> bool:
    name = str(key).lower()
    return any(part in name for part in _SENSITIVE_PARTS)


def redact(value):
    """Return a copy with the value of every sensitive-looking dict key replaced."""
    if isinstance(value, dict):
        return {k: REDACTED if _is_sensitive(k) else redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def _json_safe(data) -> dict:
    """Round-trip through Django's JSON encoder (Decimal/datetime/date/UUID -> str)."""
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise TypeError("audit data must be a dict or None")
    try:
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder, allow_nan=False))
    except ValueError as exc:  # NaN / Infinity
        raise TypeError(f"audit data is not JSON-safe: {exc}") from exc


def _actor_text(actor):
    if isinstance(actor, User):
        if actor.pk is None:
            raise TypeError("actor User must be saved")
        return format_user_id(actor.pk), actor.tenant
    if isinstance(actor, str):
        if not actor.strip():
            raise TypeError("actor must not be empty")
        return actor, None
    raise TypeError(f"actor must be a User or str, not {type(actor).__name__}")


def _entity_parts(entity, entity_type, entity_id):
    tenant = None
    if entity is None:
        pass
    elif isinstance(entity, tuple):
        if len(entity) != 2:
            raise TypeError("entity tuple must be (type, id)")
        entity_type, entity_id = entity
    elif hasattr(entity, "_meta"):
        entity_type = entity.__class__.__name__
        erp_id = getattr(entity, "erp_id", None)
        entity_id = erp_id if erp_id else entity.pk
        if isinstance(entity, Tenant):
            tenant = entity
        else:
            tenant = getattr(entity, "tenant", None)
    else:
        raise TypeError("entity must be a model instance, a (type, id) tuple or None")
    return (
        str(entity_type) if entity_type else "",
        "" if entity_id is None else str(entity_id),
        tenant,
    )


def _correlation(correlation_id):
    if correlation_id is None:
        correlation_id = get_correlation_id()
    if correlation_id is None:
        return None
    try:
        return uuid.UUID(str(correlation_id))
    except ValueError as exc:
        raise ValueError(f"invalid correlation_id: {correlation_id!r}") from exc


def record(
    actor,
    action,
    entity=None,
    correlation_id=None,
    data=None,
    tenant=None,
    entity_type=None,
    entity_id=None,
) -> AuditEvent:
    """Append one audit row and return it.

    tenant: explicit, else the entity's tenant, else the actor's tenant, else None.
    correlation_id: explicit, else the current request's, else None.
    data: JSON-safe dict, sensitive keys redacted (the caller's object is never mutated).
    """
    actor_text, actor_tenant = _actor_text(actor)
    etype, eid, entity_tenant = _entity_parts(entity, entity_type, entity_id)
    cid = _correlation(correlation_id)
    payload = redact(_json_safe(data))
    return AuditEvent.objects.create(
        tenant=tenant or entity_tenant or actor_tenant,
        actor=actor_text,
        action=action,
        entity_type=etype,
        entity_id=eid,
        correlation_id=cid,
        data=payload,
    )
