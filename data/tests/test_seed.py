"""N-02: the synthetic dataset is deterministic, consistent, and produces the documented scenario numbers."""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

DATA = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("generate_seed", DATA / "generate_seed.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

SEED_FILES = ["tenants", "suppliers", "purchase_orders", "inventory", "alternate_suppliers", "shipments"]


def load(name: str):
    return json.loads((DATA / "seed" / f"{name}.json").read_text(encoding="utf-8"))


def scenario(name: str):
    return json.loads((DATA / "scenarios" / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def seed():
    return {n: load(n) for n in SEED_FILES}


# ---------- determinism ----------

def _snapshot(root: Path) -> dict[str, str]:
    return {str(p.relative_to(root)): p.read_text(encoding="utf-8") for p in sorted(root.rglob("*.json"))}


def test_generator_is_deterministic(tmp_path):
    gen.generate(tmp_path / "a")
    gen.generate(tmp_path / "b")
    assert _snapshot(tmp_path / "a") == _snapshot(tmp_path / "b")


def test_committed_files_match_generator(tmp_path):
    """Nobody hand-edited data/seed or data/scenarios - change generate_seed.py instead."""
    gen.generate(tmp_path)
    committed = {k: v for k, v in _snapshot(DATA).items() if k.startswith(("seed", "scenarios"))}
    assert committed == _snapshot(tmp_path)


def test_as_of_shifts_all_dates(tmp_path):
    gen.generate(tmp_path, as_of=date(2026, 12, 29))
    sc = json.loads((tmp_path / "scenarios" / "demo.json").read_text(encoding="utf-8"))
    assert sc["event"]["event_time"] == "2026-12-29T10:15:00Z"
    assert sc["expected"]["affected_po_ids"] == ["PO-1001", "PO-1002"]
    assert sc["expected"]["exposure"] == {"amount": "491400.00", "currency": "INR"}
    pos = {p["po_id"]: p for p in json.loads((tmp_path / "seed" / "purchase_orders.json").read_text(encoding="utf-8"))}
    assert pos["PO-1001"]["lines"][0]["due_date"] == "2026-12-30"
    for ship in json.loads((tmp_path / "seed" / "shipments.json").read_text(encoding="utf-8")):
        assert ship["departed_at"] < "2026-12-29T23:59:59Z" <= ship["eta"] + "T23:59:59Z"


def test_as_of_without_out_is_refused(monkeypatch):
    monkeypatch.setattr("sys.argv", ["generate_seed.py", "--as-of", "2026-12-29"])
    with pytest.raises(SystemExit):
        gen.main()


# ---------- volumes (task spec) ----------

def test_volumes(seed):
    assert {t["tenant_id"] for t in seed["tenants"]} == {"TEN-ACME", "TEN-GLOBEX"}
    assert len(seed["suppliers"]) == 100
    assert len(seed["purchase_orders"]) == 500
    assert {i["location_id"] for i in seed["inventory"]} == set(gen.LOCATIONS) and len(gen.LOCATIONS) == 3
    assert len(seed["shipments"]) == 20 and all(s["status"] == "IN_TRANSIT" for s in seed["shipments"])


def test_three_deliberate_duplicate_suppliers(seed):
    by_id = {s["supplier_id"]: s for s in seed["suppliers"]}
    assert len(gen.DUPLICATES) == 3
    for dup, orig in gen.DUPLICATES.items():
        assert by_id[dup]["tax_id"] == by_id[orig]["tax_id"]
        assert by_id[dup]["name"] != by_id[orig]["name"]
        assert by_id[dup]["tenant_id"] == by_id[orig]["tenant_id"]
    tax_counts = Counter(s["tax_id"] for s in seed["suppliers"])
    assert sum(1 for c in tax_counts.values() if c > 1) == 3


# ---------- integrity ----------

def _norm(name: str) -> str:
    return " ".join(name.lower().replace(".", "").replace("private limited", "pvt ltd").split())


def test_supplier_names_unique_except_deliberate_duplicates(seed):
    names = Counter(_norm(s["name"]) for s in seed["suppliers"])
    dup_names = {n for n, c in names.items() if c > 1}
    by_id = {s["supplier_id"]: s for s in seed["suppliers"]}
    assert dup_names == {_norm(by_id[o]["name"]) for o in gen.DUPLICATES.values()}
    assert all(names[n] == 2 for n in dup_names)
    # also unique on the base name (before Pvt Ltd / Inc) across tenants
    base = Counter(" ".join(_norm(s["name"]).split()[:2]) for s in seed["suppliers"] if s["supplier_id"] not in gen.DUPLICATES)
    assert max(base.values()) == 1


def test_ids_unique(seed):
    for name, key in (("suppliers", "supplier_id"), ("purchase_orders", "po_id"), ("shipments", "shipment_id")):
        ids = [r[key] for r in seed[name]]
        assert len(ids) == len(set(ids)), name
    inv_keys = [(i["tenant_id"], i["item_id"], i["location_id"]) for i in seed["inventory"]]
    assert len(inv_keys) == len(set(inv_keys))
    alt_keys = [(a["tenant_id"], a["item_id"], a["supplier_id"]) for a in seed["alternate_suppliers"]]
    assert len(alt_keys) == len(set(alt_keys))


def test_references_stay_inside_tenant(seed):
    sup_tenant = {s["supplier_id"]: s["tenant_id"] for s in seed["suppliers"]}
    po_tenant = {p["po_id"]: p["tenant_id"] for p in seed["purchase_orders"]}
    item_tenant = {i["item_id"]: i["tenant_id"] for i in seed["inventory"]}
    for p in seed["purchase_orders"]:
        assert sup_tenant[p["supplier_id"]] == p["tenant_id"], p["po_id"]
        for l in p["lines"]:
            assert item_tenant[l["item_id"]] == p["tenant_id"], (p["po_id"], l["item_id"])
    for a in seed["alternate_suppliers"]:
        assert sup_tenant[a["supplier_id"]] == a["tenant_id"] == item_tenant[a["item_id"]]
    for s in seed["shipments"]:
        assert po_tenant[s["po_id"]] == s["tenant_id"] == sup_tenant[s["supplier_id"]]


def test_po_amounts_and_money_format(seed):
    currency = {t["tenant_id"]: t["currency"] for t in seed["tenants"]}
    for p in seed["purchase_orders"]:
        total = sum(Decimal(l["unit_price"]["amount"]) * l["qty"] for l in p["lines"])
        assert Decimal(p["amount"]["amount"]) == total
        assert p["amount"]["currency"] == currency[p["tenant_id"]]
        assert p["expected_date"] == max(l["due_date"] for l in p["lines"])
        assert p["status"] in {"OPEN", "RECEIVED", "CANCELLED"}
        for l in p["lines"]:
            assert l["qty"] > 0
            assert len(l["unit_price"]["amount"].split(".")[1]) == 2


def test_inventory_quantities_sane(seed):
    for i in seed["inventory"]:
        assert 0 <= i["reserved"] <= i["on_hand"]
        assert i["safety_stock"] >= 0 and i["daily_demand"] > 0


# ---------- scenarios ----------

ALL_SCENARIOS = sorted(p.stem for p in (DATA / "scenarios").glob("*.json"))
EVENT_KEYS = {"event_id", "tenant_id", "supplier_id", "event_type", "severity", "event_time",
              "expected_duration_hours", "description", "source_system", "correlation_id"}


def test_scenarios_cover_demo_and_all_test_cases():
    cases = {scenario(n)["test_case"] for n in ALL_SCENARIOS}
    assert {"DEMO", *(f"TC-0{i}" for i in range(1, 10))} <= cases


@pytest.mark.parametrize("name", ALL_SCENARIOS)
def test_scenario_events_are_canonical(name):
    ev = scenario(name)["event"]
    assert set(ev) == EVENT_KEYS  # CONTRACTS section 3, no extras
    assert ev["event_type"] in {"FACTORY_OUTAGE", "SHIPMENT_DELAY", "QUALITY_HOLD", "CAPACITY_REDUCTION", "LOGISTICS_DISRUPTION"}
    assert ev["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert len(ev["correlation_id"]) == 36 and ev["correlation_id"][14] == "4"


def test_event_ids_unique_across_scenarios():
    ids = [scenario(n)["event"]["event_id"] for n in ALL_SCENARIOS]
    assert len(ids) == len(set(ids))


def test_demo_numbers_match_readme():
    e = scenario("demo")["expected"]
    assert scenario("demo")["event"]["supplier_id"] == "SUP-1008"
    assert scenario("demo")["event"]["expected_duration_hours"] == 48
    assert e["evaluated_po_ids"] == ["PO-1001", "PO-1002", "PO-1003"]
    assert e["affected_po_ids"] == ["PO-1001", "PO-1002"]
    assert e["exposure"] == {"amount": "491400.00", "currency": "INR"}
    assert e["qualified_alternate_supplier_ids"] == ["SUP-2001", "SUP-2002"]
    readme = (DATA / "README.md").read_text(encoding="utf-8")
    for token in ("PO-1001", "PO-1002", "491,400.00", "SUP-2001", "SUP-2002"):
        assert token in readme


def test_readme_tables_match_generated_data():
    readme = (DATA / "README.md").read_text(encoding="utf-8")
    for name in ALL_SCENARIOS:
        amount = Decimal(scenario(name)["expected"]["exposure"]["amount"])
        if amount:
            assert f"{amount:,.2f}" in readme, name
    counts = json.loads((DATA / "seed" / "manifest.json").read_text(encoding="utf-8"))["counts"]
    for file, n in counts.items():
        assert f"| `{file}.json` | {n} |" in readme, file


def test_demo_cost_delta_matches_contract_example(seed):
    alt = next(a for a in seed["alternate_suppliers"] if a["supplier_id"] == "SUP-2001" and a["item_id"] == "ITM-501")
    po = next(p for p in seed["purchase_orders"] if p["po_id"] == "PO-1001")
    line = po["lines"][0]
    delta = (Decimal(alt["unit_price"]["amount"]) - Decimal(line["unit_price"]["amount"])) * line["qty"]
    assert delta == Decimal("33600.00")  # CONTRACTS section 6 example


def _coverage_days(seed, tenant, item):
    rows = [i for i in seed["inventory"] if i["tenant_id"] == tenant and i["item_id"] == item]
    return {r["location_id"]: (r["on_hand"] - r["reserved"]) / r["daily_demand"] for r in rows}


def _coverage_after_safety(seed, tenant, item):
    rows = [i for i in seed["inventory"] if i["tenant_id"] == tenant and i["item_id"] == item]
    return {r["location_id"]: (r["on_hand"] - r["reserved"] - r["safety_stock"]) / r["daily_demand"] for r in rows}


def test_tc04_inventory_covers_the_delay(seed):
    sc = scenario("tc04_inventory_sufficient")
    delay_days = sc["event"]["expected_duration_hours"] / 24
    # robust to the formula N-04 picks: with or without safety stock, far above the delay
    assert max(_coverage_days(seed, "TEN-ACME", "ITM-530").values()) > delay_days * 5
    assert max(_coverage_after_safety(seed, "TEN-ACME", "ITM-530").values()) > delay_days * 5
    assert sc["expected"]["shortage_expected"] is False


def test_demo_inventory_does_not_cover_the_delay(seed):
    delay_days = scenario("demo")["event"]["expected_duration_hours"] / 24
    assert _coverage_days(seed, "TEN-ACME", "ITM-501")["DC-PUNE"] < delay_days
    assert _coverage_after_safety(seed, "TEN-ACME", "ITM-501")["DC-PUNE"] < delay_days


def test_tc01_shortage_not_on_the_boundary(seed):
    delay_days = scenario("tc01_valid_event")["event"]["expected_duration_hours"] / 24
    assert _coverage_days(seed, "TEN-ACME", "ITM-515")["DC-PUNE"] <= delay_days * 0.8
    assert scenario("tc01_valid_event")["expected"]["shortage_expected"] is True


def test_tc05_has_no_alternates_and_no_other_stock(seed):
    sc = scenario("tc05_no_alternates")
    assert sc["expected"]["qualified_alternate_supplier_ids"] == []
    assert not [a for a in seed["alternate_suppliers"] if a["item_id"] == "ITM-540"]
    assert list(_coverage_days(seed, "TEN-ACME", "ITM-540")) == ["DC-PUNE"]
    sup = next(s for s in seed["suppliers"] if s["supplier_id"] == "SUP-1040")
    assert sup["capacity_per_week"] is None  # nothing for a SPLIT_ORDER to stand on
    assert sc["expected"]["no_validated_alternative_expected"] is True
    assert set(sc["expected"]["unsupported_option_types"]) == {"ALTERNATE_SUPPLIER", "INVENTORY_TRANSFER", "SPLIT_ORDER"}


def test_tc03_multiple_open_pos():
    e = scenario("tc03_multiple_open_pos")["expected"]
    assert len(e["evaluated_po_ids"]) == 6 and len(e["affected_po_ids"]) == 5


def test_tc02_and_isolation_suppliers_not_found_for_tenant():
    for name in ("tc02_unknown_supplier", "tenant_isolation"):
        e = scenario(name)["expected"]
        assert e["supplier_found"] is False and e["affected_po_ids"] == []
