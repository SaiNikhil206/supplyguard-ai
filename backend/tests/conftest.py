import pytest
from django.core.cache import cache
from rest_framework.throttling import ScopedRateThrottle

from tests.factories import make_tenant


@pytest.fixture(autouse=True)
def _auth_throttle_off(monkeypatch):
    """Login throttling must not leak between tests: high rate + empty cache by default
    (the throttle test sets a low rate itself)."""
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"auth": "100000/min"})
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def tenant_a(db):
    return make_tenant("TEN-A")


@pytest.fixture
def tenant_b(db):
    return make_tenant("TEN-B")
