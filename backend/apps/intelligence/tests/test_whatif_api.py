"""N-11 what-if endpoints, with the real mock-ERP app standing in for the ERP (no network)."""
import sys
import time
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.core import models as core_models
from apps.intelligence import views, whatif
from tests.factories import make_case, make_event, make_supplier, make_tenant, make_user
from tests.helpers import api_key_client, jwt_client

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "mock-erp"))
from app.main import app as erp_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

URL = "/api/v1/what-if"
BODY = {"supplier_id": "SUP-1008", "duration_days": 7, "event_type": "FACTORY_OUTAGE"}


@pytest.fixture(autouse=True)
def erp(monkeypatch):
    monkeypatch.setattr(views, "_client", lambda: TestClient(erp_app))


@pytest.fixture
def acme(db):
    return make_tenant("TEN-ACME", currency="INR")


@pytest.fixture
def user(acme):
    return make_user(acme, role="OPS_MANAGER")


def _write_counts():
    return {
        m.__name__: m.objects.count()
        for m in core_models.__dict__.values()
        if isinstance(m, type) and hasattr(m, "objects") and hasattr(m, "_meta")
        and not m._meta.abstract
    }


def test_sup_1008_seven_days_fast_and_labelled(user):
    t0 = time.perf_counter()
    r = jwt_client(user).post(URL, BODY, format="json")
    elapsed = time.perf_counter() - t0
    assert r.status_code == 200, r.content
    assert elapsed < 3, elapsed
    d = r.json()
    assert d["estimate"] is True
    assert set(d["labels"].values()) == {"ESTIMATE"}
    assert d["assumptions"] and any("ESTIMATE" in a for a in d["assumptions"])
    assert isinstance(d["data_gaps"], list)
    assert d["best_option_estimate"] is None or d["best_option_estimate"]["is_estimate"] is True
    assert d["scenario"]["duration_days"] == 7 and d["scenario"]["source"] == "REQUEST"
    # start = now, so 7 days ends before the seed POs fall due: stated as a data gap, not hidden
    assert any("no open purchase order line" in g for g in d["data_gaps"])


def test_long_outage_full_estimate(user):
    r = jwt_client(user).post(URL, {**BODY, "duration_days": 45}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["affected_pos"] and Decimal(d["exposure"]["amount"]) > 0
    assert d["risk"]["level"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert 0 <= d["risk"]["score"] <= 100
    assert "gaps" in d["inventory"] and d["inventory"]["coverage"]
    assert d["best_option_estimate"]["is_estimate"] is True
    assert d["best_option_estimate"]["items"]
    assert any("capacity" in g for g in d["data_gaps"])  # SUP-1008 capacity is null in the seed
    assert d["scenario"]["severity"] == "CRITICAL"


def test_no_writes_except_one_audit_row(user):
    before = _write_counts()
    audit_before = AuditEvent.objects.count()
    assert jwt_client(user).post(URL, BODY, format="json").status_code == 200
    assert _write_counts() == before
    assert AuditEvent.objects.count() == audit_before + 1
    row = AuditEvent.objects.latest("id")
    assert row.action == "what_if.run" and row.tenant_id == "TEN-ACME"
    assert row.data["supplier_id"] == "SUP-1008"


def test_unauthenticated_401():
    r = APIClient().post(URL, BODY, format="json")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"


def test_viewer_forbidden(acme):
    viewer = make_user(acme, role="VIEWER")
    assert jwt_client(viewer).post(URL, BODY, format="json").status_code == 403


def test_other_tenants_supplier_is_404_and_body_tenant_ignored(db):
    globex = make_tenant("TEN-GLOBEX", currency="INR")
    u = make_user(globex, role="ADMIN")
    # SUP-1008 belongs to TEN-ACME in the seed; a tenant_id in the body must not help
    r = jwt_client(u).post(URL, {**BODY, "tenant_id": "TEN-ACME"}, format="json")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
    assert AuditEvent.objects.filter(action="what_if.run").count() == 0


@pytest.mark.parametrize(
    "patch",
    [
        {"duration_days": 0},
        {"duration_days": 91},
        {"duration_days": "x"},
        {"event_type": "METEOR"},
        {"supplier_id": "ACME-1"},
        {"supplier_id": "SUP-1; DROP"},
    ],
)
def test_validation_errors(user, patch):
    r = jwt_client(user).post(URL, {**BODY, **patch}, format="json")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert AuditEvent.objects.filter(action="what_if.run").count() == 0


def test_missing_fields_400(user):
    assert jwt_client(user).post(URL, {}, format="json").status_code == 400


def test_erp_timeout_gives_504(user, monkeypatch):
    class Boom:
        def get(self, *a, **k):
            raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(views, "_client", lambda: Boom())
    r = jwt_client(user).post(URL, BODY, format="json")
    assert r.status_code == 504
    assert r.json()["error"]["code"] == "DOWNSTREAM_TIMEOUT"


def test_erp_down_gives_502(user, monkeypatch):
    class Down:
        def get(self, *a, **k):
            raise httpx.ConnectError("refused")

    monkeypatch.setattr(views, "_client", lambda: Down())
    r = jwt_client(user).post(URL, BODY, format="json")
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "DOWNSTREAM_ERROR"


def test_erp_unknown_supplier_404(user):
    r = jwt_client(user).post(URL, {**BODY, "supplier_id": "SUP-9999"}, format="json")
    assert r.status_code == 404


def test_longer_outage_not_less_risky(user):
    c = jwt_client(user)
    short = c.post(URL, {**BODY, "duration_days": 1}, format="json").json()
    long = c.post(URL, {**BODY, "duration_days": 30}, format="json").json()
    assert long["risk"]["score"] >= short["risk"]["score"]
    assert long["scenario"]["severity"] == "CRITICAL"


def test_system_api_key_not_allowed(acme):
    assert api_key_client(acme).post(URL, BODY, format="json").status_code == 403


# ------------------------------------------------------------------ case variant


def _case(tenant, supplier_erp="SUP-1008", hours=48):
    sup = make_supplier(tenant, erp_id=supplier_erp)
    ev = make_event(
        tenant,
        supplier=sup,
        event_type="CAPACITY_REDUCTION",
        severity="MEDIUM",
        expected_duration_hours=Decimal(hours) if hours else None,
        event_time=timezone.now() - timedelta(hours=1),
    )
    return make_case(tenant, event=ev)


def test_case_what_if_seeded_from_case(user, acme):
    case = _case(acme)
    r = jwt_client(user).post(f"/api/v1/risk-cases/{case.id}/what-if", {}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    sc = d["scenario"]
    assert sc["risk_case_id"] == case.id and sc["source"] == "RISK_CASE"
    assert sc["supplier_id"] == "SUP-1008"
    assert sc["event_type"] == "CAPACITY_REDUCTION" and sc["severity"] == "MEDIUM"
    assert sc["duration_days"] == 2
    assert d["estimate"] is True and d["assumptions"]
    row = AuditEvent.objects.latest("id")
    assert row.action == "what_if.run" and row.entity_type == "RiskCase"


def test_case_what_if_duration_override(user, acme):
    case = _case(acme)
    r = jwt_client(user).post(
        f"/api/v1/risk-cases/{case.id}/what-if", {"duration_days": 10}, format="json"
    )
    assert r.json()["scenario"]["duration_days"] == 10


def test_case_without_duration_needs_override(user, acme):
    case = _case(acme, hours=None)
    c = jwt_client(user)
    assert c.post(f"/api/v1/risk-cases/{case.id}/what-if", {}, format="json").status_code == 400
    assert (
        c.post(f"/api/v1/risk-cases/{case.id}/what-if", {"duration_days": 3}, format="json")
        .status_code
        == 200
    )


def test_case_override_validated(user, acme):
    case = _case(acme)
    r = jwt_client(user).post(
        f"/api/v1/risk-cases/{case.id}/what-if", {"duration_days": 500}, format="json"
    )
    assert r.status_code == 400


def test_case_of_other_tenant_404(user, db):
    globex = make_tenant("TEN-GLOBEX", currency="INR")
    foreign = _case(globex, supplier_erp="SUP-3001")
    r = jwt_client(user).post(f"/api/v1/risk-cases/{foreign.id}/what-if", {}, format="json")
    assert r.status_code == 404
    assert AuditEvent.objects.filter(action="what_if.run").count() == 0
    assert jwt_client(user).post(
        "/api/v1/risk-cases/RC-999999/what-if", {}, format="json"
    ).status_code == 404


def test_case_no_writes_besides_audit(user, acme):
    case = _case(acme)
    before = _write_counts()
    a = AuditEvent.objects.count()
    r = jwt_client(user).post(f"/api/v1/risk-cases/{case.id}/what-if", {}, format="json")
    assert r.status_code == 200
    assert _write_counts() == before
    assert AuditEvent.objects.count() == a + 1


# ------------------------------------------------------------------ pure helpers


def test_severity_bands():
    assert whatif.severity_for(Decimal(24)) == "MEDIUM"
    assert whatif.severity_for(Decimal(24 * 7)) == "HIGH"
    assert whatif.severity_for(Decimal(24 * 30)) == "CRITICAL"
