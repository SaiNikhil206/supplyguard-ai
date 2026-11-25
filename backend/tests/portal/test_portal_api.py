"""R-02 read APIs: tenant isolation, auth, filters, pagination, risk-case detail, query count."""

import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.audit import record
from apps.core.models import RiskCase
from apps.core.models.cases import status_change_allowed
from tests.factories import (
    make_affected,
    make_agent_run,
    make_approval,
    make_case,
    make_event,
    make_execution,
    make_po,
    make_rec,
    make_shipment,
    make_supplier,
    make_user,
)
from tests.helpers import api_key_client, jwt_client

pytestmark = pytest.mark.django_db

CASE_LIST_KEYS = {
    "id",
    "status",
    "severity",
    "supplier_id",
    "supplier_name",
    "event_type",
    "title",
    "risk_score",
    "affected_po_count",
    "exposure",
    "created_at",
    "updated_at",
}
DETAIL_SECTIONS = (
    "event",
    "affected_pos",
    "analysis",
    "recommendations",
    "approvals",
    "executions",
    "timeline",
    "no_viable_option_reason",
)


@pytest.fixture
def client_a(tenant_a):
    return jwt_client(make_user(tenant_a))


def ids(resp):
    return [r["id"] for r in resp.json()["results"]]


# ---- auth / tenancy ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "path", ["/api/v1/suppliers", "/api/v1/dashboard/summary", "/api/v1/risk-cases"]
)
def test_unauthenticated_is_401(client, path):
    assert client.get(path).status_code == 401


def test_api_key_caller_is_forbidden(tenant_a):
    assert api_key_client(tenant_a).get("/api/v1/suppliers").status_code == 403


def test_suppliers_only_own_tenant(tenant_a, tenant_b, client_a):
    mine = make_supplier(tenant_a, erp_id="SUP-1")
    make_supplier(tenant_b, erp_id="SUP-1", name="Foreign")
    make_supplier(tenant_b, erp_id="SUP-2")
    resp = client_a.get("/api/v1/suppliers")
    assert resp.status_code == 200
    assert ids(resp) == [mine.erp_id]
    assert set(resp.json()) == {"count", "next", "previous", "results"}


def test_supplier_foreign_id_404(tenant_a, tenant_b, client_a):
    make_supplier(tenant_b, erp_id="SUP-FOREIGN")
    assert client_a.get("/api/v1/suppliers/SUP-FOREIGN").status_code == 404
    assert client_a.get("/api/v1/suppliers/NOPE").status_code == 404


def test_case_foreign_id_404(tenant_a, tenant_b, client_a):
    foreign = make_case(tenant_b)
    assert client_a.get(f"/api/v1/risk-cases/{foreign.id}").status_code == 404


def test_risk_cases_only_own_tenant(tenant_a, tenant_b, client_a):
    mine = make_case(tenant_a)
    make_case(tenant_b)
    assert ids(client_a.get("/api/v1/risk-cases")) == [mine.id]


def test_dashboard_only_own_tenant(tenant_a, tenant_b, client_a):
    make_supplier(tenant_a)
    make_supplier(tenant_b)
    make_supplier(tenant_b)
    make_case(tenant_b)
    body = client_a.get("/api/v1/dashboard/summary").json()
    assert body["suppliers"] == 1
    assert body["open_cases"] == 0
    assert body["exposure"] == {"amount": "0.00", "currency": "USD"}


# ---- suppliers --------------------------------------------------------------------------------
def test_supplier_list_filters_and_shape(tenant_a, client_a):
    s1 = make_supplier(tenant_a, erp_id="SUP-A", name="Alpha Steel", risk_level="HIGH")
    make_supplier(tenant_a, erp_id="SUP-B", name="Beta Plastics", status="ON_HOLD")
    make_po(tenant_a, s1, status="OPEN")
    make_po(tenant_a, s1, status="OPEN")
    make_po(tenant_a, s1, status="RECEIVED")
    resp = client_a.get("/api/v1/suppliers?risk_level=HIGH")
    assert ids(resp) == ["SUP-A"]
    assert resp.json()["results"][0] == {
        "id": "SUP-A",
        "name": "Alpha Steel",
        "country": "",
        "category": "",
        "status": "ACTIVE",
        "risk_level": "HIGH",
        "open_po_count": 2,
        "on_time_delivery_pct": 95.5,
    }
    assert ids(client_a.get("/api/v1/suppliers?status=ON_HOLD")) == ["SUP-B"]
    assert ids(client_a.get("/api/v1/suppliers?search=plastic")) == ["SUP-B"]
    assert ids(client_a.get("/api/v1/suppliers?search=sup-a")) == ["SUP-A"]
    assert client_a.get("/api/v1/suppliers?status=BOGUS").status_code == 400


def test_supplier_pagination(tenant_a, client_a):
    for i in range(5):
        make_supplier(tenant_a, erp_id=f"SUP-{i}")
    body = client_a.get("/api/v1/suppliers?page_size=2").json()
    assert body["count"] == 5 and len(body["results"]) == 2 and body["next"]
    page3 = client_a.get("/api/v1/suppliers?page_size=2&page=3").json()
    assert len(page3["results"]) == 1 and page3["next"] is None


def test_supplier_detail(tenant_a, tenant_b, client_a):
    sup = make_supplier(tenant_a, erp_id="SUP-1", contact_email="a@b.c")
    make_po(tenant_a, sup, status="OPEN", amount=Decimal("100.00"))
    make_po(tenant_a, sup, status="OPEN", amount=Decimal("50.50"))
    make_po(tenant_a, sup, status="RECEIVED", amount=Decimal("999.00"))
    old = make_event(tenant_a, sup, event_time=timezone.now() - timedelta(days=400))
    recent = make_event(tenant_a, sup, event_time=timezone.now() - timedelta(days=5))
    case = make_case(tenant_a, recent)
    make_event(tenant_b, make_supplier(tenant_b))
    body = client_a.get("/api/v1/suppliers/SUP-1").json()
    assert body["id"] == "SUP-1" and body["contact_email"] == "a@b.c"
    assert body["open_po_count"] == 2
    kpis = body["kpis"]
    assert kpis["open_po_value"] == {"amount": "150.50", "currency": "USD"}
    assert kpis["disruptions_last_12m"] == 1
    assert kpis["on_time_delivery_pct"] == 95.5
    assert kpis["avg_lead_time_days"] == 30.0
    hist = body["disruption_history"]
    assert [h["event_id"] for h in hist] == [recent.event_id, old.event_id]
    assert hist[0]["risk_case_id"] == case.id and hist[1]["risk_case_id"] is None


# ---- dashboard --------------------------------------------------------------------------------
def test_dashboard_counts(tenant_a, client_a):
    sup = make_supplier(tenant_a)
    po = make_po(tenant_a, sup, status="OPEN")
    make_po(tenant_a, sup, status="RECEIVED")
    make_shipment(tenant_a, po, status="IN_TRANSIT")
    make_shipment(tenant_a, po, status="DELIVERED")
    make_case(tenant_a, make_event(tenant_a, sup), exposure_amount=Decimal("100.00"))
    make_case(tenant_a, make_event(tenant_a, sup), exposure_amount=Decimal("40.00"))
    done = make_case(tenant_a, make_event(tenant_a, sup), exposure_amount=Decimal("7.00"))
    with status_change_allowed():
        done.status = "RECOVERED"
        done.save()
    body = client_a.get("/api/v1/dashboard/summary").json()
    assert body["suppliers"] == 1
    assert body["open_pos"] == 1
    assert body["active_shipments"] == 1
    assert body["open_cases"] == 2
    assert body["exposure"] == {"amount": "140.00", "currency": "USD"}
    assert body["recovered_value"] == {"amount": "7.00", "currency": "USD"}
    assert len(body["exposure_trend"]) == 30 == len(body["cases_trend"])
    assert body["cases_trend"][-1]["value"] == 3
    assert body["exposure_trend"][-1]["value"] == 147.0


# ---- risk case list ---------------------------------------------------------------------------
def test_case_list_filters_and_shape(tenant_a, client_a):
    sup = make_supplier(tenant_a, erp_id="SUP-9", name="Nine")
    c1 = make_case(tenant_a, make_event(tenant_a, sup, event_type="QUALITY_HOLD"), risk_level="LOW")
    c2 = make_case(tenant_a, make_event(tenant_a, sup), risk_level="CRITICAL")
    make_affected(tenant_a, c2, po_id="PO-1", item_id="I1")
    make_affected(tenant_a, c2, po_id="PO-1", item_id="I2")
    make_affected(tenant_a, c2, po_id="PO-2", item_id="I1")
    resp = client_a.get("/api/v1/risk-cases?severity=CRITICAL")
    assert ids(resp) == [c2.id]
    row = resp.json()["results"][0]
    assert row["supplier_id"] == "SUP-9" and row["supplier_name"] == "Nine"
    assert row["event_type"] == "FACTORY_OUTAGE" and row["severity"] == "CRITICAL"
    assert row["affected_po_count"] == 2
    assert row["exposure"] == {"amount": "5000.00", "currency": "USD"}
    assert set(row) == CASE_LIST_KEYS
    assert set(ids(client_a.get("/api/v1/risk-cases?status=RECEIVED"))) == {c1.id, c2.id}
    assert ids(client_a.get("/api/v1/risk-cases?status=CLOSED")) == []
    assert client_a.get("/api/v1/risk-cases?status=NOPE").status_code == 400
    assert client_a.get("/api/v1/risk-cases?from=garbage").status_code == 400


def test_case_list_date_range_and_pagination(tenant_a, client_a):
    cases = [make_case(tenant_a) for _ in range(3)]
    base = timezone.now() - timedelta(days=10)
    for i, c in enumerate(cases):
        RiskCase.objects.filter(pk=c.pk).update(created_at=base + timedelta(days=i * 3))
    day = (base + timedelta(days=3)).date().isoformat()
    assert ids(client_a.get(f"/api/v1/risk-cases?from={day}&to={day}")) == [cases[1].id]
    assert ids(client_a.get(f"/api/v1/risk-cases?to={day}")) == [cases[1].id, cases[0].id]
    body = client_a.get("/api/v1/risk-cases?page_size=2").json()
    assert body["count"] == 3 and len(body["results"]) == 2 and body["next"]


# ---- risk case detail -------------------------------------------------------------------------
def _full_case(tenant):
    sup = make_supplier(tenant)
    case = make_case(tenant, make_event(tenant, sup, description="fire"))
    make_affected(tenant, case, po_id="PO-1", item_id="I1", inventory_coverage_days=None)
    make_affected(tenant, case, po_id="PO-2", item_id="I2", inventory_coverage_days=Decimal("4"))
    make_agent_run(tenant, case, valid=True, raw={"summary": "analysis from run"})
    recs = [
        make_rec(tenant, case, rank=1, estimated_cost_delta=Decimal("12.50"), currency="USD"),
        make_rec(tenant, case, rank=2),
    ]
    user = make_user(tenant)
    approval = make_approval(tenant, recs[0], user)
    execution = make_execution(tenant, approval, status="FAILED", error_class="TRANSIENT")
    record(
        "SYSTEM",
        "risk_case.status_changed",
        case,
        correlation_id=case.correlation_id,
        data={"from": "RECEIVED", "to": "ANALYZING", "reason": "go"},
    )
    return case, recs, approval, execution, user


def test_case_detail_has_all_sections(tenant_a, client_a):
    case, recs, approval, execution, user = _full_case(tenant_a)
    resp = client_a.get(f"/api/v1/risk-cases/{case.id}")
    assert resp.status_code == 200
    body = resp.json()
    for key in DETAIL_SECTIONS:
        assert key in body
    assert body["id"] == case.id and body["supplier_id"]
    assert body["event"]["event_id"] == case.event.event_id
    assert body["event"]["tenant_id"] == tenant_a.id
    assert body["event"]["supplier_id"] == case.event.supplier_erp_id
    pos = {p["po_id"]: p for p in body["affected_pos"]}
    assert pos["PO-1"]["stock_cover_days"] is None and pos["PO-2"]["stock_cover_days"] == 4.0
    assert pos["PO-1"]["qty"] == 10 and pos["PO-1"]["value"]["currency"] == "USD"
    assert body["analysis"] == {"summary": "analysis from run"}
    assert [r["rank"] for r in body["recommendations"]] == [1, 2]
    assert body["recommendations"][0]["estimated_cost_delta"] == {
        "amount": "12.50",
        "currency": "USD",
    }
    assert body["recommendations"][1]["estimated_cost_delta"] is None
    assert body["approvals"][0]["id"] == approval.id
    assert body["approvals"][0]["decided_by"] == f"USR-{user.pk}"
    ex = body["executions"][0]
    assert ex["id"] == execution.id and ex["recommendation_id"] == recs[0].id
    assert ex["status"] == "FAILED" and ex["retryable"] is True
    assert any(
        t["action"] == "risk_case.status_changed" and t["detail"] == "RECEIVED -> ANALYZING: go"
        for t in body["timeline"]
    )


def test_case_analysis_prefers_stored_case_analysis(tenant_a, client_a):
    case, *_ = _full_case(tenant_a)
    RiskCase.objects.filter(pk=case.pk).update(analysis={"summary": "stored"})
    body = client_a.get(f"/api/v1/risk-cases/{case.id}").json()
    assert body["analysis"] == {"summary": "stored"}


def test_case_detail_empty_sections(tenant_a, client_a):
    case = make_case(tenant_a, no_viable_option_reason="no stock")
    body = client_a.get(f"/api/v1/risk-cases/{case.id}").json()
    assert body["analysis"] is None
    assert body["affected_pos"] == [] and body["recommendations"] == []
    assert body["approvals"] == [] and body["executions"] == []
    assert body["no_viable_option_reason"] == "no stock"


def test_timeline_is_tenant_scoped(tenant_a, tenant_b, client_a):
    case = make_case(tenant_a)
    record(
        "SYSTEM", "foreign.secret", ("X", "1"), tenant=tenant_b, correlation_id=case.correlation_id
    )
    record("SYSTEM", "mine", ("X", "1"), tenant=tenant_a, correlation_id=case.correlation_id)
    record("SYSTEM", "unrelated", ("X", "1"), tenant=tenant_a, correlation_id=uuid.uuid4())
    body = client_a.get(f"/api/v1/risk-cases/{case.id}").json()
    assert [t["action"] for t in body["timeline"]] == ["mine"]


def test_case_detail_query_count_bounded(tenant_a, client_a, django_assert_max_num_queries):
    case, *_ = _full_case(tenant_a)
    with django_assert_max_num_queries(20):
        assert client_a.get(f"/api/v1/risk-cases/{case.id}").status_code == 200
    big = make_case(tenant_a)
    for i in range(15):
        make_affected(tenant_a, big, po_id=f"PO-{i}", item_id="I")
        rec = make_rec(tenant_a, big, rank=1, round=i + 1)
        make_execution(tenant_a, make_approval(tenant_a, rec, make_user(tenant_a)))
    with django_assert_max_num_queries(20):  # same bound with 15x the children
        body = client_a.get(f"/api/v1/risk-cases/{big.id}").json()
    assert len(body["executions"]) == 15


def test_list_query_count_bounded(tenant_a, client_a, django_assert_max_num_queries):
    for _ in range(10):
        make_affected(tenant_a, make_case(tenant_a))
        make_supplier(tenant_a)
    with django_assert_max_num_queries(12):
        assert client_a.get("/api/v1/risk-cases").status_code == 200
    with django_assert_max_num_queries(12):
        assert client_a.get("/api/v1/suppliers").status_code == 200
