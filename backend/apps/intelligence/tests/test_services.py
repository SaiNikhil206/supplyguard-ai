"""N-04 service tests: `create_risk_case()` against the real seed and demo scenarios."""

from __future__ import annotations

import copy
import io
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from django.core.management import call_command

from apps.core.models import AffectedPO, DisruptionEvent, RiskCase, Supplier
from apps.intelligence.services import TenantMismatch, create_risk_case
from apps.tenants.models import Tenant

ROOT = Path(__file__).resolve().parents[4]
DATA = ROOT / "data"
D = Decimal


def _load(p):
    return json.loads(p.read_text(encoding="utf-8"))


SEED = {
    n: _load(DATA / "seed" / f"{n}.json")
    for n in ("suppliers", "purchase_orders", "inventory", "alternate_suppliers")
}


def _page(rs):
    return {"count": len(rs), "results": rs}


def snapshot_for(event, captured_at="2026-12-02T10:15:03Z"):
    tid, sid = event["tenant_id"], event["supplier_id"]
    sup = next(
        (s for s in SEED["suppliers"] if s["supplier_id"] == sid and s["tenant_id"] == tid), None
    )
    pos = [p for p in SEED["purchase_orders"] if p["supplier_id"] == sid and p["tenant_id"] == tid]
    items = {ln["item_id"] for p in pos for ln in p["lines"]}
    inv = [r for r in SEED["inventory"] if r["item_id"] in items and r["tenant_id"] == tid]
    alt = [
        r for r in SEED["alternate_suppliers"] if r["item_id"] in items and r["tenant_id"] == tid
    ]
    return {
        "captured_at": captured_at,
        "supplier": sup,
        "purchase_orders": _page(pos),
        "inventory": _page(inv),
        "alternate_suppliers": _page(alt),
    }


@pytest.fixture
def seeded(db):
    call_command("load_seed", stdout=io.StringIO(), stderr=io.StringIO())
    return Tenant.objects.get(pk="TEN-ACME")


def scenario(name, tenant):
    ev = _load(DATA / "scenarios" / f"{name}.json")["event"]
    supplier = Supplier.objects.filter(tenant=tenant, erp_id=ev["supplier_id"]).first()
    event = DisruptionEvent.objects.create(
        tenant=Tenant.objects.get(pk=ev["tenant_id"]),
        event_id=ev["event_id"],
        supplier_erp_id=ev["supplier_id"],
        supplier=supplier,
        event_type=ev["event_type"],
        severity=ev["severity"],
        event_time=datetime.fromisoformat(ev["event_time"].replace("Z", "+00:00")),
        expected_duration_hours=D(str(ev["expected_duration_hours"])),
        description=ev["description"],
        source_system=ev["source_system"],
        correlation_id=ev["correlation_id"],
    )
    return event, snapshot_for(ev)


def test_demo_creates_case_and_affected_pos(seeded):
    event, snap = scenario("demo", seeded)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)

    assert case.risk_score == 67 and case.risk_level == "HIGH"
    assert case.exposure_amount == D("491400.00") and case.currency == "INR"
    assert case.supplier == event.supplier and case.correlation_id == event.correlation_id
    assert case.snapshot == snap
    assert case.snapshot_captured_at == datetime(2026, 12, 2, 10, 15, 3, tzinfo=UTC)
    assert case.impact["risk_score"] == 67 and case.impact["shortage"] is True
    assert case.data_quality_flags == case.impact["data_quality_flags"]
    assert "491400.00" in case.impact_summary and case.title

    pos = list(case.affected_pos.order_by("po_id"))
    assert [(p.po_id, p.item_id, p.item_name) for p in pos] == [
        ("PO-1001", "ITM-501", "Bracket 501"),
        ("PO-1002", "ITM-501", "Bracket 501"),
    ]
    assert sum(p.exposure_amount for p in pos) == D("491400.00")
    p1 = pos[0]
    assert p1.affected_qty == 4000 and p1.exposure_amount == D("302400.00")
    assert p1.estimated_delay_days == D("2") and p1.due_date == date(2026, 12, 3)
    assert p1.currency == "INR" and p1.shortage is True
    assert p1.inventory_coverage_days == D("1.0")
    assert [p.estimated_delay_days for p in pos] == [D("2"), D("1")]
    assert {p.tenant_id for p in pos} == {"TEN-ACME"}


def test_tc03_all_affected_pos_persisted(seeded):
    event, snap = scenario("tc03_multiple_open_pos", seeded)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    assert case.exposure_amount == D("537649.00")
    assert set(case.affected_pos.values_list("po_id", flat=True)) == {
        "PO-1007", "PO-1008", "PO-1009", "PO-1010", "PO-1011",
    }  # fmt: skip
    assert case.affected_pos.count() == len(case.impact["affected_pos"])


def test_tc04_no_shortage(seeded):
    event, snap = scenario("tc04_inventory_sufficient", seeded)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    assert case.affected_pos.count() == 2
    assert not case.affected_pos.filter(shortage=True).exists()
    assert case.impact["shortage"] is False


def test_idempotent_second_call_returns_same_case(seeded):
    event, snap = scenario("demo", seeded)
    first = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    other = copy.deepcopy(snap)
    other["captured_at"] = "2027-01-01T00:00:00Z"
    second = create_risk_case(tenant=seeded, event=event, snapshot=other)
    assert second.pk == first.pk
    assert RiskCase.objects.count() == 1 and AffectedPO.objects.count() == 2
    second.refresh_from_db()
    assert second.snapshot["captured_at"] == "2026-12-02T10:15:03Z"


def test_tenant_mismatch_raises_and_writes_nothing(seeded):
    globex = Tenant.objects.get(pk="TEN-GLOBEX")
    event, snap = scenario("demo", seeded)
    with pytest.raises(TenantMismatch):
        create_risk_case(tenant=globex, event=event, snapshot=snap)

    bad = copy.deepcopy(snap)
    bad["inventory"]["results"][0]["tenant_id"] = "TEN-GLOBEX"
    with pytest.raises(TenantMismatch):
        create_risk_case(tenant=seeded, event=event, snapshot=bad)
    assert RiskCase.objects.count() == 0 and AffectedPO.objects.count() == 0


def test_status_stays_received(seeded):
    event, snap = scenario("demo", seeded)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    case.refresh_from_db()
    assert case.status == RiskCase.Status.RECEIVED


def test_money_and_decimal_round_trip(seeded):
    event, snap = scenario("demo", seeded)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    case = RiskCase.objects.get(pk=case.pk)
    assert isinstance(case.exposure_amount, Decimal) and case.exposure_amount == D("491400.00")
    assert case.exposure_amount == D(case.impact["total_exposure"]["amount"])
    for p in AffectedPO.objects.filter(risk_case=case):
        assert isinstance(p.estimated_delay_days, Decimal)
        assert isinstance(p.exposure_amount, Decimal)
        assert isinstance(p.inventory_coverage_days, Decimal)
    assert RiskCase.objects.filter(exposure_amount=D("491400.00")).count() == 1


def test_zero_affected_returns_none_and_writes_nothing(seeded):
    event, snap = scenario("demo", seeded)
    empty = copy.deepcopy(snap)
    empty["purchase_orders"] = _page([])
    assert create_risk_case(tenant=seeded, event=event, snapshot=empty) is None
    assert RiskCase.objects.count() == 0 and AffectedPO.objects.count() == 0


def test_unknown_supplier_returns_none(seeded):
    event, snap = scenario("tc02_unknown_supplier", seeded)
    assert snap["supplier"] is None
    assert create_risk_case(tenant=seeded, event=event, snapshot=snap) is None
    assert RiskCase.objects.count() == 0


def test_missing_item_name_and_captured_at_are_blank(seeded):
    event, snap = scenario("demo", seeded)
    snap = copy.deepcopy(snap)
    snap.pop("captured_at")
    for po in snap["purchase_orders"]["results"]:
        for ln in po["lines"]:
            ln.pop("item_name", None)
    for r in snap["inventory"]["results"]:
        r.pop("item_name", None)
    case = create_risk_case(tenant=seeded, event=event, snapshot=snap)
    assert case.snapshot_captured_at is None
    assert set(case.affected_pos.values_list("item_name", flat=True)) == {""}
