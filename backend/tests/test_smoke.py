import pytest
from django.apps import apps
from django.conf import settings

EXPECTED_APPS = [
    "tenants",
    "accounts",
    "core",
    "audit",
    "integrations",
    "intelligence",
    "workflow",
    "portal",
]


@pytest.mark.django_db
def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


@pytest.mark.django_db
def test_openapi_schema_served(client):
    response = client.get("/api/schema/")
    assert response.status_code == 200
    assert b"SupplyGuard AI API" in response.content


def test_all_app_shells_registered():
    for name in EXPECTED_APPS:
        assert f"apps.{name}" in settings.INSTALLED_APPS
        assert apps.get_app_config(name).name == f"apps.{name}"
