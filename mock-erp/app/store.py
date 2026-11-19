"""In-memory ERP store loaded from data/seed/*.json (N-02). No FastAPI here - pure data + rules.

Write rules (PATCH /erp/purchase-orders/{id}), body fields:
  expected_date              -> reschedule: header expected_date AND every line due_date move to it
  supplier_id                -> reassign the whole PO to a qualified alternate (prices -> alternate's)
  supplier_id + qty [+item]  -> split: move `qty` of one line to a NEW PO at the alternate
  (expected_date may be combined with supplier_id / split to date the moved quantity)
"""

from __future__ import annotations

import copy
import json
import os
import threading
from collections import deque
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "seed"
REQUEST_LOG_MAX = 10_000


class ErpError(Exception):
    """Maps 1:1 onto the CONTRACTS section 1 error body."""

    status = {"VALIDATION_ERROR": 400, "UNAUTHENTICATED": 401, "NOT_FOUND": 404, "CONFLICT": 409,
              "BUSINESS_RULE": 422, "DOWNSTREAM_ERROR": 502}

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}
        self.http_status = self.status.get(code, 500)


def _money(amount: Decimal, currency: str) -> dict:
    return {"amount": str(amount.quantize(Decimal("0.01"))), "currency": currency}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class Store:
    def __init__(self, data_dir: Path | str | None = None):
        self.data_dir = Path(data_dir or os.environ.get("MOCK_ERP_DATA_DIR") or DEFAULT_DATA_DIR)
        self.lock = threading.RLock()
        self.generation = 0  # bumped by reset(); a request that straddles a reset must not write
        self.reset()

    # ---------- lifecycle ----------
    def _load(self, name: str) -> list[dict]:
        return json.loads((self.data_dir / f"{name}.json").read_text(encoding="utf-8"))

    def reset(self) -> dict:
        with self.lock:
            self.tenants = {t["tenant_id"]: t for t in self._load("tenants")}
            self.suppliers = {s["supplier_id"]: s for s in self._load("suppliers")}
            self.pos = {p["po_id"]: p for p in self._load("purchase_orders")}
            self.inventory = self._load("inventory")
            self.alternates = self._load("alternate_suppliers")
            self.shipments = self._load("shipments")
            self.idempotency: dict[str, dict] = {}   # key -> {"fingerprint", "status", "body"} or {"in_flight": True}
            self.request_log: deque[dict] = deque(maxlen=REQUEST_LOG_MAX)
            self.chaos = {"mode": "off", "delay_seconds": None}
            self.generation += 1
            return self.counts()

    def counts(self) -> dict:
        return {"suppliers": len(self.suppliers), "purchase_orders": len(self.pos), "inventory": len(self.inventory),
                "alternate_suppliers": len(self.alternates), "shipments": len(self.shipments)}

    # ---------- tenant scoping ----------
    def check_tenant(self, tenant_id: str | None) -> None:
        if tenant_id is not None and tenant_id not in self.tenants:
            raise ErpError("NOT_FOUND", f"unknown tenant {tenant_id}")

    @staticmethod
    def _visible(row: dict, tenant_id: str | None) -> bool:
        return tenant_id is None or row["tenant_id"] == tenant_id

    # ---------- reads ----------
    def get_supplier(self, supplier_id: str, tenant_id: str | None) -> dict:
        s = self.suppliers.get(supplier_id)
        if s is None or not self._visible(s, tenant_id):
            raise ErpError("NOT_FOUND", f"supplier {supplier_id} not found", {"supplier_id": supplier_id})
        return copy.deepcopy(s)

    def list_pos(self, tenant_id, supplier_id=None, status=None) -> list[dict]:
        with self.lock:
            rows = [p for p in self.pos.values() if self._visible(p, tenant_id)
                    and (supplier_id is None or p["supplier_id"] == supplier_id)
                    and (status is None or p["status"] == status)]
            return copy.deepcopy(sorted(rows, key=lambda p: int(p["po_id"].split("-")[1])))

    def get_po(self, po_id: str, tenant_id: str | None) -> dict:
        with self.lock:
            p = self.pos.get(po_id)
            if p is None or not self._visible(p, tenant_id):
                raise ErpError("NOT_FOUND", f"purchase order {po_id} not found", {"po_id": po_id})
            return copy.deepcopy(p)

    def list_inventory(self, tenant_id, item_id=None, location_id=None) -> list[dict]:
        return copy.deepcopy([i for i in self.inventory if self._visible(i, tenant_id)
                              and (item_id is None or i["item_id"] == item_id)
                              and (location_id is None or i["location_id"] == location_id)])

    def list_alternates(self, tenant_id, item_id=None, qualified=None) -> list[dict]:
        return copy.deepcopy([a for a in self.alternates if self._visible(a, tenant_id)
                              and (item_id is None or a["item_id"] == item_id)
                              and (qualified is None or a["qualified"] == qualified)])

    def list_shipments(self, tenant_id, po_id=None, status=None) -> list[dict]:
        return copy.deepcopy([s for s in self.shipments if self._visible(s, tenant_id)
                              and (po_id is None or s["po_id"] == po_id)
                              and (status is None or s["status"] == status)])

    # ---------- write ----------
    def _alternate(self, tenant_id: str, item_id: str, supplier_id: str) -> dict:
        for a in self.alternates:
            if a["tenant_id"] == tenant_id and a["item_id"] == item_id and a["supplier_id"] == supplier_id:
                if not a["qualified"]:
                    raise ErpError("BUSINESS_RULE", f"{supplier_id} is not qualified for {item_id}",
                                   {"supplier_id": supplier_id, "item_id": item_id})
                return a
        raise ErpError("BUSINESS_RULE", f"{supplier_id} is not an alternate supplier for {item_id}",
                       {"supplier_id": supplier_id, "item_id": item_id})

    def _next_po_id(self, tenant_id: str) -> str:
        """Next free number within the tenant's block, never colliding with any tenant's PO."""
        nums = [int(p["po_id"].split("-")[1]) for p in self.pos.values() if p["tenant_id"] == tenant_id]
        n = max(nums) + 1
        while f"PO-{n}" in self.pos:
            n += 1
        return f"PO-{n}"

    @staticmethod
    def _recalc(po: dict) -> None:
        cur = po["amount"]["currency"]
        po["amount"] = _money(sum(Decimal(l["unit_price"]["amount"]) * l["qty"] for l in po["lines"]), cur)
        po["expected_date"] = max(l["due_date"] for l in po["lines"])

    def patch_po(self, po_id: str, tenant_id: str | None, change: dict) -> dict:
        """Apply a validated change; returns {"po": ..., "created_po": ... | None, "change_type": ...}."""
        with self.lock:
            po = self.pos.get(po_id)
            if po is None or not self._visible(po, tenant_id):
                raise ErpError("NOT_FOUND", f"purchase order {po_id} not found", {"po_id": po_id})
            if po["status"] != "OPEN":
                raise ErpError("BUSINESS_RULE", f"{po_id} is {po['status']}; only OPEN POs can change", {"status": po["status"]})
            new_date = change.get("expected_date")
            new_sup = change.get("supplier_id")
            qty = change.get("qty")
            item_id = change.get("item_id")
            if new_date is not None and new_date < po["order_date"]:
                raise ErpError("BUSINESS_RULE", f"expected_date {new_date} is before the order date {po['order_date']}",
                               {"order_date": po["order_date"]})
            if qty is not None and new_sup is None:
                raise ErpError("VALIDATION_ERROR", "qty needs supplier_id (split moves qty to another supplier)")
            if new_sup is not None and new_sup == po["supplier_id"]:
                raise ErpError("BUSINESS_RULE", f"{po_id} is already with {new_sup}")
            if new_sup is not None and (new_sup not in self.suppliers or self.suppliers[new_sup]["tenant_id"] != po["tenant_id"]):
                raise ErpError("BUSINESS_RULE", f"supplier {new_sup} not found for this tenant", {"supplier_id": new_sup})

            updated = copy.deepcopy(po)
            created = None
            if new_sup is not None and qty is not None:
                # ----- split -----
                lines = [l for l in updated["lines"] if item_id is None or l["item_id"] == item_id]
                if item_id is None and len(updated["lines"]) > 1:
                    raise ErpError("VALIDATION_ERROR", "item_id is required to split a multi-line PO")
                if not lines:
                    raise ErpError("BUSINESS_RULE", f"{po_id} has no line for {item_id}", {"item_id": item_id})
                line = lines[0]
                alt = self._alternate(po["tenant_id"], line["item_id"], new_sup)
                if qty > line["qty"]:
                    raise ErpError("BUSINESS_RULE", f"cannot move {qty}; line has {line['qty']}", {"line_qty": line["qty"]})
                if qty == line["qty"] and len(updated["lines"]) == 1:
                    change_type = "REASSIGN"
                    line["unit_price"] = copy.deepcopy(alt["unit_price"])
                    updated["supplier_id"] = new_sup
                    if new_date:
                        line["due_date"] = new_date
                else:
                    change_type = "SPLIT"
                    if qty == line["qty"]:
                        updated["lines"].remove(line)
                    else:
                        line["qty"] -= qty
                    created = {
                        "po_id": self._next_po_id(po["tenant_id"]),
                        "tenant_id": po["tenant_id"],
                        "supplier_id": new_sup,
                        "order_date": date.today().isoformat(),
                        "status": "OPEN",
                        "split_from_po_id": po_id,
                        "amount": copy.deepcopy(po["amount"]),
                        "lines": [{**copy.deepcopy(line), "line_no": 1, "qty": qty,
                                   "due_date": new_date or line["due_date"], "unit_price": copy.deepcopy(alt["unit_price"])}],
                    }
                    self._recalc(created)
            elif new_sup is not None:
                # ----- reassign whole PO -----
                change_type = "REASSIGN"
                for line in updated["lines"]:
                    line["unit_price"] = copy.deepcopy(self._alternate(po["tenant_id"], line["item_id"], new_sup)["unit_price"])
                    if new_date:
                        line["due_date"] = new_date
                updated["supplier_id"] = new_sup
            elif new_date is not None:
                change_type = "RESCHEDULE"
                for line in updated["lines"]:
                    line["due_date"] = new_date
            else:
                raise ErpError("VALIDATION_ERROR", "nothing to change: send expected_date and/or supplier_id [+ qty]")

            self._recalc(updated)
            updated["last_change"] = {"change_type": change_type, "changed_at": now_iso(),
                                      "approval_id": change.get("approval_id"), "reason": change.get("reason")}
            self.pos[po_id] = updated
            if created:
                self.pos[created["po_id"]] = created
            return {"change_type": change_type, "po": copy.deepcopy(updated), "created_po": copy.deepcopy(created)}
