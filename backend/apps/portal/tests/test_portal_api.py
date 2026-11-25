import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit import record
from apps.core.models import AgentRun, RiskCase
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
from tests.helpers import jwt_client

pytestmark = pytest.mark.django_db


@pytest.fixture
def client_a(tenant_a):
    return jwt_client(make_user(tenant_a, role="VIEWER"))


def ids(resp):
    return [r["id"] for r in resp.json()["results"]]


# ---- auth / tenancy ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/suppliers",
        "/api/v1/suppliers/X",
        "/api/v1/dashboard/summary",
        "/api/v1/risk-cases",
        "/api/v1/risk-cases/RC-1",
    ],
)
def test_unauthenticated_is_401(path):
    resp = APIClient().get(path)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


def test_system_key_is_refused(tenant_a):
    from tests.helpers import api_key_client

    assert api_key_client(tenant_a).get("/api/v1/suppliers").status_code == 403


def test_suppliers_only_own_tenant(client_a, tenant_a, tenant_b):
    mine = make_supplier(tenant_a, erp_id="SUP-1")
    make_supplier(tenant_b, erp_id="SUP-1", name="Foreign")
    make_supplier(tenant_b, erp_id="SUP-2")
    body = client_a.get("/api/v1/suppliers").json()
    assert body["count"] == 1 and body["results"][0]["id"] == mine.erp_id
    assert body["results"][0]["name"] == "Acme Parts"


def test_supplier_foreign_id_404(client_a, tenant_b):
    make_supplier(tenant_b, erp_id="SUP-FOREIGN")
    resp = client_a.get("/api/v1/suppliers/SUP-FOREIGN")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_risk_case_foreign_id_404_and_list_scoped(client_a, tenant_a, tenant_b):
    mine = make_case(tenant_a)
    foreign = make_case(tenant_b)
    assert client_a.get(f"/api/v1/risk-cases/{foreign.id}").status_code == 404
    assert ids(client_a.get("/api/v1/risk-cases")) == [mine.id]


def test_dashboard_only_own_tenant(client_a, tenant_a, tenant_b):
    make_supplier(tenant_a)
    make_po(tenant_a)
    make_case(tenant_a, exposure_amount=Decimal("700.00"))
    make_supplier(tenant_b)
    make_supplier(tenant_b)
    make_case(tenant_b, exposure_amount=Decimal("99999.00"))
    body = client_a.get("/api/v1/dashboard/summary").json()
    assert body["open_cases"] == 1
    assert body["exposure"] == {"amount": "700.00", "currency": "USD"}
    assert body["suppliers"] == 3  # own: explicit + make_po + make_case; tenant B excluded
    assert len(body["exposure_trend"]) == len(body["cases_trend"]) == 30


# ---- suppliers ---------------------------------------------------------------------------
def test_supplier_filters_search_pagination(client_a, tenant_a):
    make_supplier(tenant_a, erp_id="SUP-1", name="Alpha Steel", status="ACTIVE", risk_level="LOW")
    make_supplier(tenant_a, erp_id="SUP-2", name="Beta Steel", status="ON_HOLD", risk_level="HIGH")
    make_supplier(tenant_a, erp_id="SUP-3", name="Gamma", status="ACTIVE", risk_level="HIGH")
    get = client_a.get
    assert ids(get("/api/v1/suppliers?status=ON_HOLD")) == ["SUP-2"]
    assert ids(get("/api/v1/suppliers?risk_level=HIGH")) == ["SUP-2", "SUP-3"]
    assert ids(get("/api/v1/suppliers?search=steel")) == ["SUP-1", "SUP-2"]
    assert ids(get("/api/v1/suppliers?search=SUP-3")) == ["SUP-3"]
    page = get("/api/v1/suppliers?page_size=2").json()
    assert page["count"] == 3 and len(page["results"]) == 2 and page["next"]
    assert page["previous"] is None
    assert get("/api/v1/suppliers?status=BOGUS").status_code == 400


def test_supplier_detail_kpis_and_history(client_a, tenant_a):
    sup = make_supplier(tenant_a, erp_id="SUP-9", contact_email="a@b.c")
    make_po(tenant_a, sup, amount=Decimal("100.00"))
    make_po(tenant_a, sup, amount=Decimal("50.00"))
    make_po(tenant_a, sup, amount=Decimal("999.00"), status="RECEIVED")
    evt = make_event(tenant_a, sup, description="fire")
    case = make_case(tenant_a, evt)
    old = make_event(tenant_a, sup, event_time=timezone.now() - timedelta(days=500))
    listed = client_a.get("/api/v1/suppliers").json()["results"][0]
    assert listed["open_po_count"] == 2
    body = client_a.get("/api/v1/suppliers/SUP-9").json()
    assert body["contact_email"] == "a@b.c"
    assert body["kpis"]["open_po_value"] == {"amount": "150.00", "currency": "USD"}
    assert body["kpis"]["disruptions_last_12m"] == 1
    assert body["kpis"]["avg_lead_time_days"] == 30.0
    hist = {h["event_id"]: h for h in body["disruption_history"]}
    assert hist[evt.event_id]["risk_case_id"] == case.id
    assert hist[old.event_id]["risk_case_id"] is None
    assert "risk_score" not in body and "quality_pass_pct" not in body["kpis"]


# ---- risk cases --------------------------------------------------------------------------
def test_risk_case_list_shape_and_filters(client_a, tenant_a):
    sup = make_supplier(tenant_a, erp_id="SUP-5", name="Zed")
    c1 = make_case(tenant_a, make_event(tenant_a, sup, severity="HIGH"), title="One")
    make_affected(tenant_a, c1, po_id="PO-1", item_id="A")
    make_affected(tenant_a, c1, po_id="PO-1", item_id="B")
    make_affected(tenant_a, c1, po_id="PO-2")
    c2 = make_case(
        tenant_a, make_event(tenant_a, sup, severity="LOW"), risk_level="LOW", status="CLOSED"
    )
    item = client_a.get("/api/v1/risk-cases?severity=HIGH").json()["results"][0]
    assert item["id"] == c1.id
    assert item["supplier_id"] == "SUP-5" and item["supplier_name"] == "Zed"
    assert item["affected_po_count"] == 2
    assert item["exposure"] == {"amount": "5000.00", "currency": "USD"}
    assert item["event_type"] == "FACTORY_OUTAGE" and item["title"] == "One"
    assert ids(client_a.get("/api/v1/risk-cases?status=CLOSED")) == [c2.id]
    tomorrow = (timezone.now() + timedelta(days=1)).date().isoformat()
    assert client_a.get(f"/api/v1/risk-cases?from={tomorrow}").json()["count"] == 0
    assert client_a.get(f"/api/v1/risk-cases?to={tomorrow}").json()["count"] == 2
    assert client_a.get("/api/v1/risk-cases?from=nope").status_code == 400
    assert client_a.get("/api/v1/risk-cases?status=NOPE").status_code == 400
    page = client_a.get("/api/v1/risk-cases?page_size=1").json()
    assert page["count"] == 2 and len(page["results"]) == 1 and page["next"]


def _full_case(tenant, n_pos=1):
    sup = make_supplier(tenant)
    evt = make_event(tenant, sup)
    case = make_case(tenant, evt, title="Full")
    for i in range(n_pos):
        make_affected(tenant, case, po_id=f"PO-F{i}")
    make_agent_run(tenant, case, valid=False, raw={"summary": "bad"})
    make_agent_run(tenant, case, valid=True, raw={"summary": "old"})
    make_agent_run(tenant, case, valid=True, raw={"summary": "latest"})
    RiskCase.objects.filter(pk=case.pk).update(
        analysis={"summary": "stored"}, data_quality_flags=["MISSING_ETA"]
    )
    recs = [make_rec(tenant, case, estimated_cost_delta=Decimal("12.50"), currency="USD")]
    recs.append(make_rec(tenant, case))
    approval = make_approval(tenant, recs[0])
    make_execution(tenant, approval, status="FAILED", error_class="TRANSIENT", error="boom")
    make_approval(tenant, recs[1], decision="REJECT")
    record(
        "SYSTEM", "case.created", ("RiskCase", case.id), tenant=tenant, data={"detail": "created"}
    )
    record("SYSTEM", "event.received", None, tenant=tenant, correlation_id=case.correlation_id)
    record("SYSTEM", "other", None, tenant=tenant, correlation_id=uuid.uuid4())
    return case


def test_risk_case_detail_has_all_sections(client_a, tenant_a, tenant_b):
    case = _full_case(tenant_a)
    # foreign audit row with same correlation id must not leak into the timeline
    record("SYSTEM", "foreign.leak", None, tenant=tenant_b, correlation_id=case.correlation_id)
    body = client_a.get(f"/api/v1/risk-cases/{case.id}").json()
    for key in (
        "event",
        "affected_pos",
        "analysis",
        "recommendations",
        "approvals",
        "executions",
        "timeline",
    ):
        assert key in body
    assert body["event"]["event_id"] == case.event.event_id
    assert body["event"]["correlation_id"] == str(case.correlation_id)
    assert len(body["affected_pos"]) == 1
    assert body["affected_pos"][0]["value"]["currency"] == "USD"
    assert body["analysis"] == {"summary": "stored"}  # RiskCase.analysis, not AgentRun
    assert body["data_quality_flags"] == ["MISSING_ETA"]
    assert body["recommendations"][0]["unsupported_reasons"] == []
    assert len(body["recommendations"]) == 2
    assert body["recommendations"][0]["estimated_cost_delta"] == {
        "amount": "12.50",
        "currency": "USD",
    }
    assert body["recommendations"][1]["estimated_cost_delta"] is None
    assert len(body["approvals"]) == 2 and body["approvals"][0]["decided_by"]
    assert len(body["executions"]) == 1
    assert body["executions"][0]["retryable"] is True
    assert body["affected_po_count"] == 1
    actions = [t["action"] for t in body["timeline"]]
    assert "case.created" in actions and "event.received" in actions
    assert "other" not in actions and "foreign.leak" not in actions
    assert [t["detail"] for t in body["timeline"] if t["action"] == "case.created"] == ["created"]


def test_risk_case_detail_without_analysis(client_a, tenant_a):
    case = make_case(tenant_a)
    body = client_a.get(f"/api/v1/risk-cases/{case.id}").json()
    assert body["analysis"] is None
    assert body["recommendations"] == body["approvals"] == body["executions"] == []
    assert AgentRun.objects.count() == 0


def test_analysis_null_when_case_analysis_empty_even_with_valid_agent_run(client_a, tenant_a):
    case = make_case(tenant_a)
    make_agent_run(tenant_a, case, valid=True, raw={"summary": "only in the run"})
    assert client_a.get(f"/api/v1/risk-cases/{case.id}").json()["analysis"] is None


def test_timeline_detail_from_real_transition_and_other_shapes(client_a, tenant_a):
    from apps.workflow.services import transition

    case = make_case(tenant_a, status="RECEIVED")
    transition(case, "ANALYZING", actor="SYSTEM", reason="intake complete")
    record(
        "SYSTEM",
        "x.err",
        ("RiskCase", case.id),
        tenant=tenant_a,
        data={"error": "ValueError: secret detail"},
    )
    record("SYSTEM", "x.reason", ("RiskCase", case.id), tenant=tenant_a, data={"reason": "why"})
    record("SYSTEM", "x.dec", ("RiskCase", case.id), tenant=tenant_a, data={"decision": "APPROVE"})
    record("SYSTEM", "x.none", ("RiskCase", case.id), tenant=tenant_a, data={})
    rows = client_a.get(f"/api/v1/risk-cases/{case.id}").json()["timeline"]
    by_action = {r["action"]: r for r in rows}
    changed = by_action["risk_case.status_changed"]
    assert changed["detail"] == "RECEIVED -> ANALYZING (intake complete)"
    assert changed["actor"] == "SYSTEM"
    assert by_action["x.err"]["detail"] == "ValueError"
    assert by_action["x.reason"]["detail"] == "why"
    assert by_action["x.dec"]["detail"] == "decision: APPROVE"
    assert by_action["x.none"]["detail"] == ""


def test_timeline_keeps_newest_200_oldest_first(client_a, tenant_a):
    case = make_case(tenant_a)
    for i in range(205):
        record("SYSTEM", f"n.{i:03d}", ("RiskCase", case.id), tenant=tenant_a)
    tl = client_a.get(f"/api/v1/risk-cases/{case.id}").json()["timeline"]
    assert len(tl) == 200
    assert tl[0]["at"] <= tl[-1]["at"]
    assert tl[-1]["action"] == "n.204" and "n.004" not in [t["action"] for t in tl]


def test_rejected_case_still_counts_as_open_and_other_currency_not_summed(client_a, tenant_a):
    make_case(tenant_a, status="REJECTED", exposure_amount=Decimal("300.00"))
    make_case(tenant_a, exposure_amount=Decimal("900.00"), currency="EUR")
    body = client_a.get("/api/v1/dashboard/summary").json()
    assert body["open_cases"] == 2
    assert body["exposure"] == {"amount": "300.00", "currency": "USD"}
    assert sum(p["value"] for p in body["exposure_trend"]) == 300.0


def test_detail_query_count_is_bounded(client_a, tenant_a, django_assert_max_num_queries):
    small = _full_case(tenant_a, n_pos=1)
    big = _full_case(tenant_a, n_pos=8)
    with django_assert_max_num_queries(16):
        assert client_a.get(f"/api/v1/risk-cases/{small.id}").status_code == 200
    with django_assert_max_num_queries(16):  # same bound with 8x the affected POs
        assert client_a.get(f"/api/v1/risk-cases/{big.id}").status_code == 200


def test_list_query_counts_do_not_grow(client_a, tenant_a, django_assert_max_num_queries):
    for _ in range(6):
        make_case(tenant_a)
        make_shipment(tenant_a)
    with django_assert_max_num_queries(8):
        assert client_a.get("/api/v1/risk-cases").json()["count"] == 6
    with django_assert_max_num_queries(8):
        assert client_a.get("/api/v1/suppliers").status_code == 200
    with django_assert_max_num_queries(14):
        assert client_a.get("/api/v1/dashboard/summary").status_code == 200
