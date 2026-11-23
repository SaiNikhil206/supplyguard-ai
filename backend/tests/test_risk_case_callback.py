"""POST /api/v1/internal/risk-cases: end-to-end against the real impact engine and the seed,
idempotency, tenant isolation, flagged events, bad snapshots (U-06 piece 2)."""
import json
from decimal import Decimal
from pathlib import Path
from unittest import mock

import pytest
from django.core.management import call_command

from apps.audit.models import AuditEvent
from apps.core.models import AffectedPO, DisruptionEvent, RiskCase
from tests.factories import make_supplier, make_tenant, make_user
from tests.helpers import api_key_client, jwt_client, strip_cid

pytestmark = pytest.mark.django_db
URL = "/api/v1/internal/risk-cases"
EVENTS = "/api/v1/events/disruptions"
ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "data" / "seed"
DEMO = json.loads((ROOT / "data" / "scenarios" / "demo.json").read_text(encoding="utf-8"))


def seed(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def demo_snapshot():
    """What Boomi would assemble from the ERP for SUP-1008 (field names = CONTRACTS s5)."""
    tenant, supplier_id = "TEN-ACME", DEMO["event"]["supplier_id"]
    supplier = next(
        s for s in seed("suppliers") if s["supplier_id"] == supplier_id and s["tenant_id"] == tenant
    )
    pos = [
        p
        for p in seed("purchase_orders")
        if p["supplier_id"] == supplier_id and p["tenant_id"] == tenant and p["status"] == "OPEN"
    ]
    items = {line["item_id"] for p in pos for line in p["lines"]}
    return {
        "captured_at": "2026-12-02T10:16:00Z",
        "supplier": supplier,
        "purchase_orders": pos,
        "inventory": [
            i for i in seed("inventory") if i["tenant_id"] == tenant and i["item_id"] in items
        ],
        "alternate_suppliers": [
            a
            for a in seed("alternate_suppliers")
            if a["tenant_id"] == tenant and a["item_id"] in items
        ],
    }


@pytest.fixture
def acme(db):
    call_command("load_seed", stdout=mock.MagicMock())
    from apps.tenants.models import Tenant

    return Tenant.objects.get(id="TEN-ACME")


@pytest.fixture
def key(acme):
    return api_key_client(acme)


def intake(client, **overrides):
    body = {**DEMO["event"], **overrides}
    return client.post(EVENTS, body, format="json")


def post(client, event_id, snapshot, **extra):
    return client.post(URL, {"event_id": event_id, "snapshot": snapshot, **extra}, format="json")


def audits(action, tenant=None):
    qs = AuditEvent.objects.filter(action=action)
    return qs.filter(tenant=tenant) if tenant else qs


# --- end to end: the demo scenario -------------------------------------------------------------
def test_demo_scenario_end_to_end(key, acme):
    assert intake(key).status_code == 202
    snapshot = demo_snapshot()
    response = post(key, DEMO["event"]["event_id"], snapshot)
    assert response.status_code == 201, response.content
    body = response.json()
    expected = DEMO["expected"]

    case = RiskCase.objects.get(pk=body["risk_case_id"])
    assert body["risk_case_id"].startswith("RC-")
    assert body["exposure"] == expected["exposure"] == {"amount": "491400.00", "currency": "INR"}
    assert body["status"] == "RECEIVED" == case.status
    assert body["correlation_id"] == DEMO["event"]["correlation_id"]
    assert body["affected_po_count"] == 2
    assert body["risk_level"] == case.risk_level
    assert body["risk_score"] == case.risk_score
    assert body["data_quality_flags"] == case.data_quality_flags

    # stored case
    assert case.tenant_id == "TEN-ACME"
    assert case.event.event_id == DEMO["event"]["event_id"]
    assert case.supplier.erp_id == "SUP-1008"
    assert case.exposure_amount == Decimal("491400.00") and case.currency == "INR"
    assert case.analysis_round == 1
    assert str(case.correlation_id) == DEMO["event"]["correlation_id"]
    assert case.snapshot == snapshot  # as received, money strings unchanged
    assert case.snapshot["purchase_orders"][0]["lines"][0]["unit_price"]["amount"] == "75.60"
    assert case.snapshot_captured_at.isoformat() == "2026-12-02T10:16:00+00:00"
    assert case.title == "FACTORY_OUTAGE at Shakti Components Pvt Ltd"
    assert case.impact_summary == (
        f"2 POs affected, exposure 491400.00 INR, risk {case.risk_level} ({case.risk_score})"
    )

    # stored impact = the engine result, matches the scenario's expected block
    impact = case.impact
    assert impact["supplier_found"] is expected["supplier_found"]
    assert impact["evaluated_po_ids"] == expected["evaluated_po_ids"]
    assert impact["affected_po_ids"] == expected["affected_po_ids"]
    assert impact["affected_item_ids"] == expected["affected_item_ids"]
    assert impact["total_exposure"] == expected["exposure"]
    assert impact["qualified_alternate_supplier_ids"] == (
        expected["qualified_alternate_supplier_ids"]
    )
    assert impact["shortage"] is expected["shortage_expected"]
    assert impact["risk_score"] == case.risk_score and impact["risk_level"] == case.risk_level

    rows = list(AffectedPO.objects.filter(risk_case=case).order_by("po_id"))
    assert [r.po_id for r in rows] == expected["affected_po_ids"]
    assert {r.item_id for r in rows} == set(expected["affected_item_ids"])
    assert {r.item_name for r in rows} == {"Bracket 501"}
    assert {r.tenant_id for r in rows} == {"TEN-ACME"} and {r.currency for r in rows} == {"INR"}
    assert sum(r.exposure_amount for r in rows) == Decimal("491400.00")
    assert all(r.shortage for r in rows)
    assert all(r.affected_qty > 0 and r.estimated_delay_days > 0 for r in rows)

    # audit row: actor SYSTEM, caller's tenant, no snapshot data
    (row,) = audits("risk_case.created")
    assert row.actor == "SYSTEM" and row.tenant_id == "TEN-ACME"
    assert (row.entity_type, row.entity_id) == ("RiskCase", case.id)
    assert row.data == {
        "risk_level": case.risk_level,
        "risk_score": case.risk_score,
        "affected_po_count": 2,
    }
    assert "Shakti" not in json.dumps(row.data)


def test_tc09_duplicate_intake_now_returns_the_case_id_and_one_case(key):
    first = intake(key)
    assert first.status_code == 202
    created = post(key, DEMO["event"]["event_id"], demo_snapshot()).json()
    dup = intake(key)
    assert dup.status_code == 200
    assert dup.json()["risk_case_id"] == created["risk_case_id"]
    assert dup.json()["correlation_id"] == first.json()["correlation_id"]
    assert RiskCase.objects.count() == 1


# --- idempotency -------------------------------------------------------------------------------
def test_second_identical_post_is_200_same_case_and_does_not_recompute(key):
    intake(key)
    first = post(key, DEMO["event"]["event_id"], demo_snapshot())
    assert first.status_code == 201
    with mock.patch("apps.integrations.risk_cases.compute_impact") as engine:
        second = post(key, DEMO["event"]["event_id"], demo_snapshot())
    assert second.status_code == 200
    assert second.json() == first.json()
    engine.assert_not_called()
    assert RiskCase.objects.count() == 1
    assert AffectedPO.objects.count() == 2
    assert audits("risk_case.created").count() == 1


def test_lost_race_is_answered_as_the_existing_case(key, acme):
    from apps.integrations import risk_cases
    from tests.factories import make_case

    intake(key)
    event = DisruptionEvent.objects.get(event_id=DEMO["event"]["event_id"])
    real_compute = risk_cases.compute

    def compute_then_lose_the_race(tenant, ev, snapshot):
        result = real_compute(tenant, ev, snapshot)
        make_case(tenant, event=ev, risk_level="LOW", risk_score=1)  # the other request wins
        return result

    with mock.patch.object(risk_cases, "compute", side_effect=compute_then_lose_the_race):
        response = post(key, event.event_id, demo_snapshot())
    assert response.status_code == 200
    assert response.json()["risk_score"] == 1  # the winner's case, not ours
    assert RiskCase.objects.count() == 1
    assert AffectedPO.objects.count() == 0 and not audits("risk_case.created").exists()


# --- tenant isolation + roles ------------------------------------------------------------------
@pytest.mark.parametrize("role", ["ADMIN", "PROCUREMENT_MANAGER", "OPS_MANAGER", "VIEWER"])
def test_user_tokens_are_403(acme, role):
    client = jwt_client(make_user(acme, role=role))
    response = post(client, DEMO["event"]["event_id"], demo_snapshot())
    assert response.status_code == 403
    assert RiskCase.objects.count() == 0


def test_anonymous_is_401(acme):
    from rest_framework.test import APIClient

    assert post(APIClient(), "EVT-000123", demo_snapshot()).status_code == 401


def test_another_tenants_event_is_the_same_404_as_unknown_and_audited(key, acme):
    intake(key)
    globex = make_tenant("TEN-OTHER", currency="USD")
    foreign = api_key_client(globex)
    snap = demo_snapshot()
    hit = post(foreign, DEMO["event"]["event_id"], snap)
    miss = post(foreign, "EVT-999999", snap)
    assert hit.status_code == miss.status_code == 404
    assert strip_cid(hit) == strip_cid(miss)
    assert "SUP-1008" not in hit.content.decode()
    assert RiskCase.objects.count() == 0

    (row,) = audits("security.cross_tenant_denied")
    assert row.tenant_id == "TEN-OTHER"  # the CALLER's tenant, never the owner's
    assert row.actor == "SYSTEM"
    assert (row.entity_type, row.entity_id) == ("DisruptionEvent", DEMO["event"]["event_id"])
    assert not audits("security.cross_tenant_denied", acme).exists()


def test_tenant_in_body_is_ignored(key, acme):
    intake(key)
    globex = make_tenant("TEN-OTHER", currency="USD")
    response = post(key, DEMO["event"]["event_id"], demo_snapshot(), tenant_id="TEN-OTHER")
    assert response.status_code == 201
    assert RiskCase.objects.get().tenant_id == "TEN-ACME"
    # and the other way round: naming our tenant does not unlock another tenant's event
    foreign = api_key_client(globex)
    assert post(foreign, DEMO["event"]["event_id"], demo_snapshot(), tenant_id="TEN-ACME"
                ).status_code == 404


# --- flagged events / missing supplier ---------------------------------------------------------
def test_event_flagged_for_data_correction_is_409_and_no_case(key):
    # TC-02: unknown supplier is stored flagged by the intake
    intake(key, event_id="EVT-000555", supplier_id="SUP-NOPE")
    assert DisruptionEvent.objects.get(event_id="EVT-000555").needs_data_correction
    response = post(key, "EVT-000555", demo_snapshot())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"
    assert response.json()["error"]["message"] == "event is flagged for data correction"
    assert RiskCase.objects.count() == 0


def test_supplier_null_flags_the_event_and_creates_no_case(key):
    intake(key)
    snapshot = {"captured_at": "2026-12-02T10:16:00Z", "supplier": None}
    response = post(key, DEMO["event"]["event_id"], snapshot)
    assert response.status_code == 200
    assert response.json() == {"risk_case_id": None, "flagged": True}
    assert DisruptionEvent.objects.get(event_id=DEMO["event"]["event_id"]).needs_data_correction
    assert RiskCase.objects.count() == 0
    (row,) = audits("event.flagged_data_correction")
    assert row.actor == "SYSTEM" and row.tenant_id == "TEN-ACME"
    # once flagged a repeat is the 409
    assert post(key, DEMO["event"]["event_id"], snapshot).status_code == 409


def test_supplier_omitted_is_also_flagged(key):
    intake(key)
    response = post(key, DEMO["event"]["event_id"], {"captured_at": "2026-12-02T10:16:00Z"})
    assert response.json() == {"risk_case_id": None, "flagged": True}


# --- bad snapshots -----------------------------------------------------------------------------
def _po(po_id="PO-1", qty=10, currency="INR", tenant_id=None, price="10.00"):
    po = {
        "po_id": po_id,
        "supplier_id": "SUP-1008",
        "status": "OPEN",
        "lines": [
            {
                "line_no": 1,
                "item_id": "ITM-501",
                "qty": qty,
                "due_date": "2026-12-03",
                "unit_price": {"amount": price, "currency": currency},
            }
        ],
    }
    if tenant_id:
        po["tenant_id"] = tenant_id
    return po


def _snap(**kw):
    base = demo_snapshot()
    base["purchase_orders"] = [_po()]
    base.update(kw)
    return base


@pytest.mark.parametrize(
    "mutate",
    [
        lambda s: s.update(purchase_orders=[_po(tenant_id="TEN-OTHER")]),
        lambda s: s.update(purchase_orders=[_po("PO-1"), _po("PO-2", currency="USD")]),
        lambda s: s.update(purchase_orders=[_po(qty=-5)]),
    ],
    ids=["foreign-tenant-row", "mixed-currencies", "negative-qty"],
)
def test_snapshot_errors_are_400_and_never_echoed(key, mutate):
    intake(key)
    snapshot = _snap()
    mutate(snapshot)
    response = post(key, DEMO["event"]["event_id"], snapshot)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    text = response.content.decode()
    assert "Shakti" not in text and "orders@sup-1008" not in text
    assert RiskCase.objects.count() == 0 and AffectedPO.objects.count() == 0


def test_unknown_snapshot_keys_are_400(key):
    intake(key)
    response = post(key, DEMO["event"]["event_id"], _snap(extra_stuff=[1]))
    assert response.status_code == 400
    assert "extra_stuff" in response.json()["error"]["details"]["snapshot"]


@pytest.mark.parametrize(
    "bad",
    [
        {"captured_at": "2026-12-02T10:16:00"},  # naive
        {"purchase_orders": "nope"},
        {"purchase_orders": [1, 2]},
        {"supplier": "x"},
    ],
)
def test_structural_validation(key, bad):
    intake(key)
    response = post(key, DEMO["event"]["event_id"], _snap(**bad))
    assert response.status_code == 400


def test_more_than_5000_rows_is_400(key):
    intake(key)
    rows = [{"item_id": "ITM-501"}] * 5001
    assert post(key, DEMO["event"]["event_id"], _snap(inventory=rows)).status_code == 400


def test_oversized_body_is_a_clean_400(key, settings):
    intake(key)
    settings.DATA_UPLOAD_MAX_MEMORY_SIZE = 50_000
    big = _snap(purchase_orders=[{"po_id": "PO-1", "note": "a" * 60_000}])
    response = post(key, DEMO["event"]["event_id"], big)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR" and "too large" in json.dumps(error)
    assert RiskCase.objects.count() == 0


def test_non_object_body_is_400(key):
    response = key.post(URL, [1, 2], format="json")
    assert response.status_code == 400


def test_event_without_duration_is_400(key, acme):
    intake(key, event_id="EVT-000777", expected_duration_hours=None)
    response = post(key, "EVT-000777", demo_snapshot())
    assert response.status_code == 400
    assert "duration" in response.content.decode()


def test_unconfigured_supplier_is_not_needed_for_other_tenant_isolation(acme):
    """A second tenant with its own SUP-1008 never sees ACME's case."""
    other = make_tenant("TEN-OTHER", currency="USD")
    make_supplier(other, erp_id="SUP-1008")
    foreign = api_key_client(other)
    intake(api_key_client(acme))
    assert post(foreign, DEMO["event"]["event_id"], demo_snapshot()).status_code == 404
