import copy
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from apps.audit import record
from apps.audit.context import reset_correlation_id, set_correlation_id
from apps.audit.models import AuditAppendOnly, AuditEvent
from tests.factories import make_supplier, make_tenant, make_user

pytestmark = pytest.mark.django_db


def test_actor_user_formats_id_and_gives_tenant(tenant_a):
    user = make_user(tenant_a)
    event = record(user, "x.done")
    assert event.actor == f"USR-{user.pk}"
    assert event.tenant == tenant_a


@pytest.mark.parametrize("actor", ["SYSTEM", "boomi:erp-sync"])
def test_actor_strings(actor):
    event = record(actor, "x.done")
    assert event.actor == actor
    assert event.tenant is None


@pytest.mark.parametrize("bad", [None, 5, object(), ""])
def test_bad_actor_type(bad):
    with pytest.raises(TypeError):
        record(bad, "x.done")


def test_entity_model_with_erp_id(tenant_a):
    supplier = make_supplier(tenant_a, erp_id="SUP-9")
    event = record("SYSTEM", "supplier.seen", entity=supplier)
    assert (event.entity_type, event.entity_id) == ("Supplier", "SUP-9")
    assert event.tenant == tenant_a


def test_entity_model_without_erp_id_uses_pk(tenant_a):
    user = make_user(tenant_a)
    event = record("SYSTEM", "user.seen", entity=user)
    assert (event.entity_type, event.entity_id) == ("User", str(user.pk))


def test_entity_tuple_and_none_and_explicit():
    assert record("SYSTEM", "a", entity=("RiskCase", "RC-1")).entity_id == "RC-1"
    none = record("SYSTEM", "a")
    assert (none.entity_type, none.entity_id) == ("", "")
    explicit = record("SYSTEM", "a", entity_type="Foo", entity_id=7)
    assert (explicit.entity_type, explicit.entity_id) == ("Foo", "7")


def test_bad_entity():
    with pytest.raises(TypeError):
        record("SYSTEM", "a", entity="RC-1")
    with pytest.raises(TypeError):
        record("SYSTEM", "a", entity=("a", "b", "c"))


def test_tenant_derivation_order(tenant_a, tenant_b):
    user_b = make_user(tenant_b)
    supplier_a = make_supplier(tenant_a)
    assert record(user_b, "a", entity=supplier_a, tenant=tenant_b).tenant == tenant_b  # explicit
    assert record(user_b, "a", entity=supplier_a).tenant == tenant_a  # entity beats actor
    assert record(user_b, "a").tenant == tenant_b  # actor
    assert record("SYSTEM", "a").tenant is None  # nothing


def test_correlation_id_from_context_explicit_and_none():
    cid = str(uuid.uuid4())
    token = set_correlation_id(cid)
    try:
        assert str(record("SYSTEM", "a").correlation_id) == cid
        other = uuid.uuid4()
        assert record("SYSTEM", "a", correlation_id=other).correlation_id == other
    finally:
        reset_correlation_id(token)
    assert record("SYSTEM", "a").correlation_id is None


def test_invalid_explicit_correlation_id():
    with pytest.raises(ValueError):
        record("SYSTEM", "a", correlation_id="nope")


def test_redaction_nested_list_mixed_case_without_mutation():
    data = {
        "Password": "p",
        "ok": 1,
        "nested": {"API_KEY": "k", "keep": "v", "deep": [{"AccessToken": "t", "n": 2}]},
        "list": [{"Authorization": "Bearer x"}, "plain"],
        "headers": {"Set-Cookie": "c", "x_credentials": "z", "my_private_key": "pk"},
        "apikey": "a",
        "passwd": "b",
        "client_secret": "s",
    }
    original = copy.deepcopy(data)
    stored = record("SYSTEM", "a", data=data).data
    assert data == original  # not mutated
    assert stored["Password"] == "[REDACTED]"
    assert stored["ok"] == 1
    assert stored["nested"]["API_KEY"] == "[REDACTED]"
    assert stored["nested"]["keep"] == "v"
    assert stored["nested"]["deep"] == [{"AccessToken": "[REDACTED]", "n": 2}]
    assert stored["list"] == [{"Authorization": "[REDACTED]"}, "plain"]
    assert stored["headers"] == {
        "Set-Cookie": "[REDACTED]",
        "x_credentials": "[REDACTED]",
        "my_private_key": "[REDACTED]",
    }
    for key in ("apikey", "passwd", "client_secret"):
        assert stored[key] == "[REDACTED]"
    # Persisted value is redacted too, not just the returned object.
    assert AuditEvent.objects.get().data == stored


def test_json_safe_conversion():
    uid = uuid.uuid4()
    stored = record(
        "SYSTEM",
        "a",
        data={
            "amount": Decimal("12.50"),
            "when": datetime(2026, 11, 23, 10, 0, tzinfo=UTC),
            "day": date(2026, 11, 23),
            "id": uid,
        },
    ).data
    assert stored["amount"] == "12.50"
    assert stored["when"].startswith("2026-11-23T10:00:00")
    assert stored["day"] == "2026-11-23"
    assert stored["id"] == str(uid)


@pytest.mark.parametrize("bad", [{"x": object()}, {"x": {1, 2}}, {"x": float("nan")}, [1], "s"])
def test_non_serialisable_rejected(bad):
    with pytest.raises(TypeError):
        record("SYSTEM", "a", data=bad)
    assert AuditEvent.objects.count() == 0


def test_stored_row_is_append_only():
    event = record("SYSTEM", "a")
    event.action = "changed"
    with pytest.raises(AuditAppendOnly):
        event.save()
    with pytest.raises(AuditAppendOnly):
        event.delete()
    with pytest.raises(AuditAppendOnly):
        AuditEvent.objects.all().delete()
    with pytest.raises(AuditAppendOnly):
        AuditEvent.objects.update(action="z")


def test_lazy_import_does_not_need_registry():
    import apps.audit

    assert callable(apps.audit.record)
    assert make_tenant  # silence unused import lint if helper changes
