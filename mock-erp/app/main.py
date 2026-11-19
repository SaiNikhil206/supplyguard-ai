"""Mock ERP - FastAPI app implementing docs/CONTRACTS.md section 5 (task N-03). Only Boomi calls it.

Run:  uvicorn app.main:app --port 8081        (from mock-erp/)
Env:  MOCK_ERP_DATA_DIR   seed dir (default ../data/seed)
      MOCK_ERP_API_KEY    if set, every /erp/* call needs header X-Api-Key with this value
      MOCK_ERP_CHAOS_DELAY_SECONDS  default hang for chaos "timeout" (default 35, i.e. > 30 s)
      MOCK_ERP_ENABLE_TEST_ENDPOINTS  "true" (default) / "false": /erp/_chaos, _reset, _requests
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from datetime import date
from typing import Literal

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .store import ErpError, Store, now_iso

DEFAULT_CHAOS_DELAY = float(os.environ.get("MOCK_ERP_CHAOS_DELAY_SECONDS", "35"))
SUPPLIER_ID = r"^SUP-[0-9]+$"
PO_ID = r"^PO-[0-9]+$"

app = FastAPI(title="SupplyGuard Mock ERP", version="1.0.0",
              description="Demo ERP for SupplyGuard AI. CONTRACTS section 5. Synthetic data only.")
store = Store()
log_lock = threading.Lock()


# ---------------------------------------------------------------- errors (CONTRACTS section 1)

def error_body(code: str, message: str, request: Request, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {},
                      "correlation_id": getattr(request.state, "correlation_id", None)}}


@app.exception_handler(ErpError)
async def erp_error_handler(request: Request, exc: ErpError):
    headers = {"Retry-After": str(exc.retry_after)} if getattr(exc, "retry_after", None) else None
    return JSONResponse(error_body(exc.code, exc.message, request, exc.details), status_code=exc.http_status, headers=headers)


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    return JSONResponse(error_body("INTERNAL_ERROR", "unexpected mock ERP error", request), status_code=500)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg"), "type": e.get("type")} for e in exc.errors()]
    return JSONResponse(error_body("VALIDATION_ERROR", "request validation failed", request, {"errors": errors}),
                        status_code=400)


# ---------------------------------------------------------------- middleware: correlation id, auth, request log

@app.middleware("http")
async def correlation_auth_and_log(request: Request, call_next):
    corr = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    request.state.correlation_id = corr
    path = request.url.path
    entry = None
    if path.startswith("/erp/") and path != "/erp/_requests":
        entry = {
            "time": now_iso(),
            "method": request.method,
            "path": path,
            "query": dict(request.query_params),
            "tenant_id": request.headers.get("X-Tenant-ID"),
            "correlation_id": corr,
            "idempotency_key": request.headers.get("Idempotency-Key"),
            "status": None,  # filled when the response is sent (stays null while a chaos timeout hangs)
            "write_applied": False,
        }
        request.state.log_entry = entry
        with log_lock:
            store.request_log.append(entry)
    api_key = os.environ.get("MOCK_ERP_API_KEY")
    if api_key and path.startswith("/erp/") and not hmac.compare_digest(request.headers.get("X-Api-Key", ""), api_key):
        response = JSONResponse(error_body("UNAUTHENTICATED", "missing or invalid X-Api-Key", request), status_code=401)
    else:
        started = time.perf_counter()
        response = await call_next(request)
        if entry is not None:
            entry["duration_ms"] = round((time.perf_counter() - started) * 1000, 1)
    response.headers["X-Correlation-ID"] = corr
    if entry is not None:
        entry["status"] = response.status_code
    return response


def tenant(x_tenant_id: str | None = Header(default=None, pattern=r"^TEN-[A-Z0-9]+$")) -> str | None:
    """Optional X-Tenant-ID: when present, every read/write is limited to that tenant's rows."""
    store.check_tenant(x_tenant_id)
    return x_tenant_id


def required_tenant(x_tenant_id: str | None = Header(default=None, pattern=r"^TEN-[A-Z0-9]+$")) -> str:
    """Writes must say which tenant they act for (CONTRACTS s1: tenant context is passed through by Boomi)."""
    if x_tenant_id is None:
        raise ErpError("VALIDATION_ERROR", "X-Tenant-ID header is required for writes")
    store.check_tenant(x_tenant_id)
    return x_tenant_id


def test_endpoints_enabled() -> None:
    if os.environ.get("MOCK_ERP_ENABLE_TEST_ENDPOINTS", "true").lower() in {"0", "false", "no"}:
        raise ErpError("NOT_FOUND", "test endpoints are disabled (MOCK_ERP_ENABLE_TEST_ENDPOINTS=false)")


def page(rows: list[dict]) -> dict:
    return {"count": len(rows), "results": rows}


# ---------------------------------------------------------------- reads

@app.get("/health")
def health():
    return {"status": "ok", "counts": store.counts(), "chaos": store.chaos["mode"]}


@app.get("/erp/suppliers/{supplier_id}")
def get_supplier(supplier_id: str, tenant_id: str | None = Depends(tenant)):
    return store.get_supplier(supplier_id, tenant_id)


@app.get("/erp/purchase-orders")
def list_purchase_orders(supplier_id: str | None = Query(default=None, pattern=SUPPLIER_ID),
                         status: Literal["OPEN", "RECEIVED", "CANCELLED"] | None = None,
                         tenant_id: str | None = Depends(tenant)):
    return page(store.list_pos(tenant_id, supplier_id, status))


@app.get("/erp/purchase-orders/{po_id}")
def get_purchase_order(po_id: str, tenant_id: str | None = Depends(tenant)):
    return store.get_po(po_id, tenant_id)


@app.get("/erp/inventory")
def list_inventory(item_id: str | None = None, location_id: str | None = None,
                   tenant_id: str | None = Depends(tenant)):
    return page(store.list_inventory(tenant_id, item_id, location_id))


@app.get("/erp/alternate-suppliers")
def list_alternate_suppliers(item_id: str | None = None, qualified: bool | None = None,
                             tenant_id: str | None = Depends(tenant)):
    return page(store.list_alternates(tenant_id, item_id, qualified))


@app.get("/erp/shipments")
def list_shipments(po_id: str | None = Query(default=None, pattern=PO_ID), status: str | None = None,
                   tenant_id: str | None = Depends(tenant)):
    return page(store.list_shipments(tenant_id, po_id, status))


# ---------------------------------------------------------------- write

class PoChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_date: date | None = None
    supplier_id: str | None = Field(default=None, pattern=SUPPLIER_ID)
    qty: int | None = Field(default=None, gt=0)
    item_id: str | None = None
    approval_id: str | None = Field(default=None, description="SupplyGuard approval reference, stored on the PO for audit")
    reason: str | None = None


def _conflict(reason: str, message: str, key: str, retry_after: int | None = None) -> ErpError:
    err = ErpError("CONFLICT", message, {"reason": reason, "idempotency_key": key})
    err.retry_after = retry_after
    return err


@app.patch("/erp/purchase-orders/{po_id}")
async def patch_purchase_order(po_id: str, change: PoChange, request: Request,
                               idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=200),
                               tenant_id: str = Depends(required_tenant)):
    entry = getattr(request.state, "log_entry", {})
    body = change.model_dump(mode="json", exclude_none=True)
    entry["body"] = body
    entry["po_id"] = po_id
    if not idempotency_key or not idempotency_key.strip():
        raise ErpError("VALIDATION_ERROR", "Idempotency-Key header is required for PATCH")
    fingerprint = hashlib.sha256(json.dumps([po_id, tenant_id, body], sort_keys=True).encode()).hexdigest()

    with store.lock:
        seen = store.idempotency.get(idempotency_key)
        if seen is not None:
            if seen.get("in_flight"):
                raise _conflict("IN_FLIGHT", "a request with this Idempotency-Key is still in progress; retry later",
                                idempotency_key, retry_after=5)
            if seen["fingerprint"] != fingerprint:
                raise _conflict("KEY_REUSED", "Idempotency-Key was already used with a different request", idempotency_key)
            entry["replayed"] = True
            return JSONResponse(seen["body"], status_code=seen["status"], headers={"Idempotent-Replayed": "true"})
        store.idempotency[idempotency_key] = {"in_flight": True}
        chaos = dict(store.chaos)
        generation = store.generation

    def release_key() -> None:
        with store.lock:
            if store.generation == generation:
                store.idempotency.pop(idempotency_key, None)

    try:
        if chaos["mode"] == "500":
            release_key()  # nothing happened: a retry with the same key may run
            return JSONResponse(error_body("INTERNAL_ERROR", "chaos mode 500: simulated ERP failure", request),
                                status_code=500)
        if chaos["mode"] == "timeout":
            # Hang, THEN apply: the caller times out but the write still lands - exactly the case where a
            # retry with the same Idempotency-Key must not update the PO twice. Async sleep: no worker thread held.
            await asyncio.sleep(chaos["delay_seconds"] if chaos["delay_seconds"] is not None else DEFAULT_CHAOS_DELAY)

        def apply():
            with store.lock:
                if store.generation != generation:  # a reset happened while we hung: never write into fresh seed
                    raise _conflict("RESET_DURING_REQUEST", "the ERP was reset while this request was running; nothing applied",
                                    idempotency_key)
                try:
                    result = store.patch_po(po_id, tenant_id, body)
                    status, payload = 200, {"idempotency_key": idempotency_key, **result}
                    entry["write_applied"] = True
                except ErpError as exc:
                    status, payload = exc.http_status, error_body(exc.code, exc.message, request, exc.details)
                store.idempotency[idempotency_key] = {"fingerprint": fingerprint, "status": status, "body": payload}
                return status, payload

        status, payload = await run_in_threadpool(apply)
        return JSONResponse(payload, status_code=status)
    except BaseException:
        release_key()
        raise


# ---------------------------------------------------------------- test-only controls

class ChaosRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["timeout", "500", "off"]
    delay_seconds: float | None = Field(default=None, ge=0, le=300)


@app.post("/erp/_chaos", dependencies=[Depends(test_endpoints_enabled)])
def set_chaos(req: ChaosRequest):
    """TC-08. Affects PATCH only. timeout: hang delay_seconds (default > 30 s) then apply; 500: fail, no write."""
    with store.lock:
        store.chaos = {"mode": req.mode, "delay_seconds": req.delay_seconds}
    return {"mode": req.mode, "delay_seconds": req.delay_seconds if req.delay_seconds is not None
            else (DEFAULT_CHAOS_DELAY if req.mode == "timeout" else None)}


@app.post("/erp/_reset", dependencies=[Depends(test_endpoints_enabled)])
def reset():
    """Reload seed data; clear idempotency keys, request log and chaos. Run between TC-06/07/08."""
    with log_lock:
        counts = store.reset()
    return {"status": "reset", "counts": counts}


@app.get("/erp/_requests", dependencies=[Depends(test_endpoints_enabled)])
def request_log(method: str | None = None, po_id: str | None = None, path_contains: str | None = None):
    """Request log for assertions, e.g. TC-06: no PATCH with write_applied=true for the rejected PO."""
    with log_lock:
        rows = [e for e in store.request_log
                if (method is None or e["method"] == method.upper())
                and (po_id is None or e.get("po_id") == po_id or e["path"].rstrip("/").split("/")[-1] == po_id)
                and (path_contains is None or path_contains in e["path"])]
        return page([dict(e) for e in rows])
