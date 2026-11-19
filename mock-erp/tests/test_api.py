"""N-03 mock ERP: CONTRACTS section 5 endpoints, idempotent PATCH, chaos, reset, request log."""

from __future__ import annotations

import threading
import time

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app, store

ACME = {"X-Tenant-ID": "TEN-ACME"}


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    monkeypatch.delenv("MOCK_ERP_API_KEY", raising=False)
    store.reset()
    yield
    store.reset()


@pytest.fixture
def client():
    return TestClient(app)


def patch(client, po_id, body, key="EXE-1", headers=None):
    return client.patch(f"/erp/purchase-orders/{po_id}", json=body, headers={**ACME, "Idempotency-Key": key, **(headers or {})})


# ---------------------------------------------------------------- reads (acceptance 1)

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["counts"]["purchase_orders"] == 500


def test_get_supplier(client):
    r = client.get("/erp/suppliers/SUP-1008", headers=ACME)
    assert r.status_code == 200
    assert r.json()["name"] == "Shakti Components Pvt Ltd"
    assert r.json()["capacity_per_week"] is None


def test_open_pos_by_supplier_demo(client):
    r = client.get("/erp/purchase-orders", params={"supplier_id": "SUP-1008", "status": "OPEN"}, headers=ACME)
    body = r.json()
    assert r.status_code == 200
    assert [p["po_id"] for p in body["results"]] == ["PO-1001", "PO-1002", "PO-1003"]
    assert body["count"] == 3
    line = body["results"][0]["lines"][0]
    assert set(line) >= {"item_id", "qty", "due_date", "unit_price"}  # CONTRACTS s5
    assert line["unit_price"] == {"amount": "75.60", "currency": "INR"}


def test_get_single_po(client):
    assert client.get("/erp/purchase-orders/PO-1004", headers=ACME).json()["status"] == "RECEIVED"


def test_inventory_by_item(client):
    rows = client.get("/erp/inventory", params={"item_id": "ITM-501"}, headers=ACME).json()["results"]
    assert {r["location_id"] for r in rows} == {"DC-PUNE", "DC-CHENNAI"}
    assert set(rows[0]) >= {"on_hand", "reserved", "safety_stock", "location_id"}


def test_alternates_by_item(client):
    rows = client.get("/erp/alternate-suppliers", params={"item_id": "ITM-501"}, headers=ACME).json()["results"]
    assert [(a["supplier_id"], a["lead_time_days"], a["unit_price"]["amount"], a["capacity"]) for a in rows] == [
        ("SUP-2001", 2, "84.00", 5000), ("SUP-2002", 5, "79.50", None)]


def test_tc05_item_has_no_alternates(client):
    assert client.get("/erp/alternate-suppliers", params={"item_id": "ITM-540"}, headers=ACME).json()["count"] == 0


def test_shipments(client):
    assert client.get("/erp/shipments", params={"status": "IN_TRANSIT"}).json()["count"] == 20


def test_not_found_uses_contract_error_body(client):
    r = client.get("/erp/suppliers/SUP-9999", headers={**ACME, "X-Correlation-ID": "c-1"})
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "NOT_FOUND", "message": "supplier SUP-9999 not found",
                                  "details": {"supplier_id": "SUP-9999"}, "correlation_id": "c-1"}}
    assert r.headers["X-Correlation-ID"] == "c-1"


def test_validation_error_is_400(client):
    r = client.get("/erp/purchase-orders", params={"status": "BOGUS"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------- tenant scoping

def test_tenant_header_hides_other_tenant_rows(client):
    assert client.get("/erp/suppliers/SUP-3005", headers=ACME).status_code == 404
    assert client.get("/erp/suppliers/SUP-3005", headers={"X-Tenant-ID": "TEN-GLOBEX"}).status_code == 200
    pos = client.get("/erp/purchase-orders", headers=ACME).json()["results"]
    assert pos and all(p["tenant_id"] == "TEN-ACME" for p in pos)


def test_unknown_tenant_404(client):
    assert client.get("/erp/inventory", headers={"X-Tenant-ID": "TEN-NOPE"}).status_code == 404


def test_cross_tenant_patch_refused(client):
    r = patch(client, "PO-5001", {"expected_date": "2026-12-20"})
    assert r.status_code == 404


# ---------------------------------------------------------------- writes

def test_reschedule_moves_header_and_lines(client):
    r = patch(client, "PO-1001", {"expected_date": "2026-12-05", "approval_id": "APR-1"})
    assert r.status_code == 200 and r.json()["change_type"] == "RESCHEDULE"
    po = client.get("/erp/purchase-orders/PO-1001").json()
    assert po["expected_date"] == "2026-12-05"
    assert all(l["due_date"] == "2026-12-05" for l in po["lines"])
    assert po["last_change"]["approval_id"] == "APR-1"


def test_reassign_to_alternate_reprices(client):
    r = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 4000})  # demo rank-1 option
    assert r.status_code == 200 and r.json()["change_type"] == "REASSIGN"
    po = r.json()["po"]
    assert po["supplier_id"] == "SUP-2001"
    assert po["lines"][0]["unit_price"]["amount"] == "84.00"
    assert po["amount"] == {"amount": "336000.00", "currency": "INR"}  # 302,400.00 + 33,600.00 delta


def test_split_creates_new_po(client):
    r = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000, "expected_date": "2026-12-04"})
    body = r.json()
    assert r.status_code == 200 and body["change_type"] == "SPLIT"
    assert body["po"]["lines"][0]["qty"] == 3000
    new = body["created_po"]
    assert new["po_id"] == "PO-1301" and new["supplier_id"] == "SUP-2001" and new["split_from_po_id"] == "PO-1001"
    assert new["lines"][0]["qty"] == 1000 and new["lines"][0]["due_date"] == "2026-12-04"
    assert client.get("/erp/purchase-orders/PO-1301").status_code == 200


@pytest.mark.parametrize("body,code", [
    ({"supplier_id": "SUP-1015"}, "BUSINESS_RULE"),            # not an alternate for ITM-501
    ({"supplier_id": "SUP-2001", "qty": 99999}, "BUSINESS_RULE"),
    ({"qty": 10}, "VALIDATION_ERROR"),                         # qty without supplier
    ({}, "VALIDATION_ERROR"),
    ({"expected_date": "05-12-2026"}, "VALIDATION_ERROR"),
    ({"supplier_id": "SUP-2001", "price": "1.00"}, "VALIDATION_ERROR"),  # unknown field
])
def test_bad_changes_rejected_and_po_untouched(client, body, code):
    before = client.get("/erp/purchase-orders/PO-1001").json()
    r = patch(client, "PO-1001", body)
    assert r.json()["error"]["code"] == code
    assert client.get("/erp/purchase-orders/PO-1001").json() == before


def test_only_open_pos_change(client):
    r = patch(client, "PO-1004", {"expected_date": "2026-12-20"})
    assert r.status_code == 422


@pytest.mark.parametrize("key", [None, "", "   "])
def test_idempotency_key_required(client, key):
    headers = {**ACME, **({"Idempotency-Key": key} if key is not None else {})}
    r = client.patch("/erp/purchase-orders/PO-1001", json={"expected_date": "2026-12-05"}, headers=headers)
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_tenant_required_on_patch(client):
    r = client.patch("/erp/purchase-orders/PO-5001", json={"expected_date": "2026-12-20"}, headers={"Idempotency-Key": "k"})
    assert r.status_code == 400
    assert client.get("/erp/purchase-orders/PO-5001").json()["expected_date"] != "2026-12-20"


def test_cancelled_po_cannot_change(client):
    po = next(p for p in store.pos.values() if p["status"] == "CANCELLED" and p["tenant_id"] == "TEN-ACME")
    assert patch(client, po["po_id"], {"expected_date": "2026-12-20"}).status_code == 422


def test_reschedule_before_order_date_rejected(client):
    r = patch(client, "PO-1001", {"expected_date": "2020-01-01"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "BUSINESS_RULE"


def _multiline_po_with_alternate():
    """An OPEN ACME PO with >= 2 lines where one line's item has a qualified alternate."""
    for po in store.pos.values():
        if po["tenant_id"] != "TEN-ACME" or po["status"] != "OPEN" or len(po["lines"]) < 2:
            continue
        for line in po["lines"]:
            alts = [a for a in store.alternates if a["item_id"] == line["item_id"] and a["qualified"]
                    and a["supplier_id"] != po["supplier_id"]]
            if alts and line["qty"] > 1:
                return po, line, alts[0]
    pytest.skip("no suitable multi-line PO in seed")


def test_split_multiline_needs_item_id_then_moves_only_that_line(client):
    po, line, alt = _multiline_po_with_alternate()
    r = patch(client, po["po_id"], {"supplier_id": alt["supplier_id"], "qty": 1})
    assert r.status_code == 400  # ambiguous without item_id
    r = patch(client, po["po_id"], {"supplier_id": alt["supplier_id"], "qty": 1, "item_id": line["item_id"]}, key="EXE-ML")
    assert r.status_code == 200 and r.json()["change_type"] == "SPLIT"
    after = client.get(f"/erp/purchase-orders/{po['po_id']}").json()
    moved = next(l for l in after["lines"] if l["line_no"] == line["line_no"])
    assert moved["qty"] == line["qty"] - 1
    others_before = [l for l in po["lines"] if l["line_no"] != line["line_no"]]
    assert [l for l in after["lines"] if l["line_no"] != line["line_no"]] == others_before
    assert r.json()["created_po"]["lines"][0]["unit_price"] == alt["unit_price"]


def _qualified(item_id, supplier_id):
    return any(a["item_id"] == item_id and a["supplier_id"] == supplier_id and a["qualified"] for a in store.alternates)


def test_reassign_whole_po_fails_atomically_if_any_item_lacks_alternate(client):
    for po in store.pos.values():
        if po["tenant_id"] != "TEN-ACME" or po["status"] != "OPEN" or len(po["lines"]) < 2:
            continue
        for line in po["lines"]:
            for alt in [a for a in store.alternates if a["item_id"] == line["item_id"] and a["qualified"]]:
                if not all(_qualified(l["item_id"], alt["supplier_id"]) for l in po["lines"]):
                    before = client.get(f"/erp/purchase-orders/{po['po_id']}").json()
                    r = patch(client, po["po_id"], {"supplier_id": alt["supplier_id"]})
                    assert r.status_code == 422
                    assert client.get(f"/erp/purchase-orders/{po['po_id']}").json() == before
                    return
    pytest.skip("no suitable PO in seed")


# ---------------------------------------------------------------- idempotency (acceptance 2)

def test_same_key_twice_returns_first_result_no_double_update(client):
    first = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-42")
    second = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-42")
    assert second.status_code == first.status_code == 200
    assert second.json() == first.json()
    assert second.headers["Idempotent-Replayed"] == "true"
    po = client.get("/erp/purchase-orders/PO-1001").json()
    assert po["lines"][0]["qty"] == 3000  # moved once, not twice
    assert client.get("/erp/purchase-orders/PO-1302").status_code == 404  # no second split PO
    applied = [e for e in client.get("/erp/_requests", params={"method": "PATCH"}).json()["results"] if e["write_applied"]]
    assert len(applied) == 1


def test_same_key_different_body_conflicts(client):
    patch(client, "PO-1001", {"expected_date": "2026-12-05"}, key="EXE-7")
    r = patch(client, "PO-1001", {"expected_date": "2026-12-06"}, key="EXE-7")
    assert r.status_code == 409 and r.json()["error"]["code"] == "CONFLICT"
    assert r.json()["error"]["details"]["reason"] == "KEY_REUSED"


def test_same_key_on_different_po_conflicts(client):
    patch(client, "PO-1001", {"expected_date": "2026-12-05"}, key="EXE-8")
    r = patch(client, "PO-1002", {"expected_date": "2026-12-05"}, key="EXE-8")
    assert r.status_code == 409 and r.json()["error"]["details"]["reason"] == "KEY_REUSED"
    assert client.get("/erp/purchase-orders/PO-1002").json()["expected_date"] == "2026-12-04"


def test_failed_business_rule_is_replayed_too(client):
    a = patch(client, "PO-1004", {"expected_date": "2026-12-20"}, key="EXE-9")
    b = patch(client, "PO-1004", {"expected_date": "2026-12-20"}, key="EXE-9")
    assert a.status_code == b.status_code == 422 and b.headers["Idempotent-Replayed"] == "true"


# ---------------------------------------------------------------- chaos (acceptance 3)

def test_default_timeout_hangs_over_30s(client):
    assert main.DEFAULT_CHAOS_DELAY > 30
    assert client.post("/erp/_chaos", json={"mode": "timeout"}).json()["delay_seconds"] > 30


def test_timeout_then_retry_with_same_key_applies_once(client):
    client.post("/erp/_chaos", json={"mode": "timeout", "delay_seconds": 1.0})
    results = {}

    def slow():
        results["first"] = patch(TestClient(app), "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-T")

    t = threading.Thread(target=slow)
    started = time.perf_counter()
    t.start()
    time.sleep(0.3)
    during = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-T")
    assert during.status_code == 409  # still in flight: the retry is refused, not applied
    assert during.json()["error"]["details"]["reason"] == "IN_FLIGHT" and during.headers["Retry-After"] == "5"
    t.join()
    assert time.perf_counter() - started >= 0.95  # Windows timer granularity ~15 ms
    assert results["first"].status_code == 200
    client.post("/erp/_chaos", json={"mode": "off"})
    after = patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-T")
    assert after.headers.get("Idempotent-Replayed") == "true"
    assert client.get("/erp/purchase-orders/PO-1001").json()["lines"][0]["qty"] == 3000


def test_reset_during_hung_patch_does_not_write_into_fresh_seed(client):
    client.post("/erp/_chaos", json={"mode": "timeout", "delay_seconds": 1.0})
    results = {}

    def slow():
        results["r"] = patch(TestClient(app), "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-R")

    t = threading.Thread(target=slow)
    t.start()
    time.sleep(0.3)
    client.post("/erp/_reset")
    t.join()
    assert results["r"].status_code == 409
    assert results["r"].json()["error"]["details"]["reason"] == "RESET_DURING_REQUEST"
    assert client.get("/erp/purchase-orders/PO-1001").json()["lines"][0]["qty"] == 4000
    assert client.get("/erp/purchase-orders/PO-1301").status_code == 404
    assert "EXE-R" not in store.idempotency
    assert patch(client, "PO-1001", {"supplier_id": "SUP-2001", "qty": 1000}, key="EXE-R").status_code == 200


def test_chaos_500_fails_without_write_and_off_restores(client):
    client.post("/erp/_chaos", json={"mode": "500"})
    r = patch(client, "PO-1001", {"expected_date": "2026-12-05"}, key="EXE-5")
    assert r.status_code == 500
    assert client.get("/erp/purchase-orders/PO-1001").json()["expected_date"] == "2026-12-03"
    client.post("/erp/_chaos", json={"mode": "off"})
    assert patch(client, "PO-1001", {"expected_date": "2026-12-05"}, key="EXE-5").status_code == 200  # same key retried


def test_chaos_does_not_affect_reads(client):
    client.post("/erp/_chaos", json={"mode": "500"})
    assert client.get("/erp/suppliers/SUP-1008").status_code == 200


# ---------------------------------------------------------------- reset + request log

def test_reset_restores_seed_and_clears_state(client):
    patch(client, "PO-1001", {"expected_date": "2026-12-05"})
    client.post("/erp/_chaos", json={"mode": "500"})
    r = client.post("/erp/_reset")
    assert r.json()["counts"]["purchase_orders"] == 500
    assert client.get("/erp/purchase-orders/PO-1001").json()["expected_date"] == "2026-12-03"
    assert client.get("/health").json()["chaos"] == "off"
    assert patch(client, "PO-1001", {"expected_date": "2026-12-05"}).headers.get("Idempotent-Replayed") is None


def test_request_log_supports_tc06_assertion(client):
    """TC-06: after a rejection, the log shows reads but no applied write for the PO."""
    client.get("/erp/purchase-orders/PO-1001", headers={"X-Correlation-ID": "corr-6"})
    log = client.get("/erp/_requests", params={"po_id": "PO-1001"}).json()["results"]
    assert len(log) == 1 and log[0]["method"] == "GET" and log[0]["correlation_id"] == "corr-6"
    assert not [e for e in log if e["method"] == "PATCH"]
    patch(client, "PO-1001", {"expected_date": "2026-12-05"}, key="EXE-L")
    entry = client.get("/erp/_requests", params={"method": "PATCH"}).json()["results"][0]
    assert entry["idempotency_key"] == "EXE-L" and entry["write_applied"] and entry["status"] == 200
    assert entry["body"] == {"expected_date": "2026-12-05"}


def test_request_log_po_filter_is_exact(client):
    client.get("/erp/purchase-orders/PO-1001")
    assert client.get("/erp/_requests", params={"po_id": "PO-100"}).json()["count"] == 0
    assert client.get("/erp/_requests", params={"po_id": "PO-1001"}).json()["count"] == 1


def test_request_log_is_bounded():
    from app.store import REQUEST_LOG_MAX
    assert store.request_log.maxlen == REQUEST_LOG_MAX


def test_test_endpoints_can_be_disabled(client, monkeypatch):
    monkeypatch.setenv("MOCK_ERP_ENABLE_TEST_ENDPOINTS", "false")
    assert client.post("/erp/_reset").status_code == 404
    assert client.post("/erp/_chaos", json={"mode": "off"}).status_code == 404
    assert client.get("/erp/_requests").status_code == 404
    assert client.get("/erp/suppliers/SUP-1008").status_code == 200


# ---------------------------------------------------------------- api key

def test_api_key_enforced_when_configured(client, monkeypatch):
    monkeypatch.setenv("MOCK_ERP_API_KEY", "test-key")
    assert client.get("/erp/suppliers/SUP-1008").status_code == 401
    assert client.get("/erp/suppliers/SUP-1008", headers={"X-Api-Key": "test-key"}).status_code == 200
    assert client.get("/health").status_code == 200
    assert client.post("/erp/_reset").status_code == 401
    assert client.post("/erp/_chaos", json={"mode": "500"}).status_code == 401
    assert client.post("/erp/_reset", headers={"X-Api-Key": "test-key"}).status_code == 200
