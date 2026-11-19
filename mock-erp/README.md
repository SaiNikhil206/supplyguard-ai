# mock-erp/ - Demo ERP service

Owner: **Nikhil** (N-03). FastAPI app implementing `docs/CONTRACTS.md` section 5. Only Boomi calls it. Loads `data/seed/` (N-02) into memory; every restart or `POST /erp/_reset` returns to the seed state.

## Run
```
pip install -r mock-erp/requirements-dev.txt
cd mock-erp && uvicorn app.main:app --port 8081 --reload      # http://localhost:8081/docs
cd mock-erp && python -m pytest tests -q
docker build -f mock-erp/Dockerfile -t supplyguard-mock-erp .  # from the repo root
docker run --rm -p 8081:8081 supplyguard-mock-erp
```

**Compose service for Uday's `docker-compose.yml`** (owned by Uday, so not edited here):
```yaml
  mock-erp:
    build: { context: ., dockerfile: mock-erp/Dockerfile }
    ports: ["8081:8081"]
    environment:
      MOCK_ERP_API_KEY: ${MOCK_ERP_API_KEY:-}   # empty = no auth (local only)
```

| Env var | Default | Meaning |
|---|---|---|
| `MOCK_ERP_DATA_DIR` | `../data/seed` (`/srv/data/seed` in Docker) | seed files to load |
| `MOCK_ERP_API_KEY` | unset | if set, every `/erp/*` call needs `X-Api-Key: <value>` (set it whenever the service is reachable from outside, e.g. the Boomi tunnel) |
| `MOCK_ERP_CHAOS_DELAY_SECONDS` | `35` | default hang for chaos `timeout` |
| `MOCK_ERP_ENABLE_TEST_ENDPOINTS` | `true` | `false` hides `_chaos`, `_reset`, `_requests` (404). Keep `true` only where tests/demo need them, and always with an API key when reachable from outside |

## Headers
- `X-Tenant-ID`: **required on PATCH**, optional on reads (absent = all tenants). When present, only that tenant's rows are visible; another tenant's id -> 404. Boomi should always send it.
- `X-Correlation-ID`: echoed back and stored in the request log; generated if missing.
- `Idempotency-Key`: **required** on PATCH (U-10 uses `execution_id`).

## Endpoints
| Method & path | Notes |
|---|---|
| `GET /health` | counts + chaos mode (no auth) |
| `GET /erp/suppliers/{id}` | supplier master record |
| `GET /erp/purchase-orders?supplier_id=&status=OPEN` | `{count, results}`; PO with `lines[]` (`item_id`, `qty`, `due_date`, `unit_price`) |
| `GET /erp/purchase-orders/{id}` | single PO (U-10 re-reads after a write to verify) |
| `GET /erp/inventory?item_id=&location_id=` | `on_hand`, `reserved`, `safety_stock`, `daily_demand` per location |
| `GET /erp/alternate-suppliers?item_id=&qualified=` | `lead_time_days`, `unit_price`, `capacity` (units/week, null = unknown), `qualified` |
| `GET /erp/shipments?po_id=&status=` | extension (not in CONTRACTS s5) |
| `PATCH /erp/purchase-orders/{id}` | see below |
| `POST /erp/_chaos` | test only: `{"mode": "timeout"\|"500"\|"off", "delay_seconds": 35}` |
| `POST /erp/_reset` | test only: reload seed, clear idempotency keys, request log and chaos |
| `GET /erp/_requests?method=&po_id=&path_contains=` | test only: request log |

Errors use the CONTRACTS section 1 body `{"error": {code, message, details, correlation_id}}`: 400 `VALIDATION_ERROR`, 401, 404, 409 `CONFLICT`, 422 `BUSINESS_RULE`; chaos 500 returns code `INTERNAL_ERROR` (Boomi maps it to `DOWNSTREAM_ERROR`).

## PATCH body (only OPEN POs)
| Body | Effect | `change_type` |
|---|---|---|
| `{"expected_date": "2026-12-05"}` | header `expected_date` and every line `due_date` move | `RESCHEDULE` |
| `{"supplier_id": "SUP-2001"}` | whole PO to a **qualified alternate** for each item; prices become the alternate's | `REASSIGN` |
| `{"supplier_id": "SUP-2001", "qty": 1000, "item_id": "ITM-501"}` | move 1000 of that line to a new PO at the alternate (`split_from_po_id`); `item_id` needed only for multi-line POs; qty = whole single line -> `REASSIGN` | `SPLIT` |
| + `"expected_date"` | dates the moved quantity | |
| + `"approval_id"`, `"reason"` | stored on the PO as `last_change` for audit | |

This maps from a recovery option's `proposed_action.change` (N-01 schema) for ALTERNATE_SUPPLIER, SPLIT_ORDER and REVISED_SCHEDULE. **INVENTORY_TRANSFER is not a PO change** - its location fields are rejected here (400); U-10 must not send it to this endpoint. Response: `{idempotency_key, change_type, po, created_po}`. Unknown fields -> 400; supplier that is not a qualified alternate (for every line, on a whole-PO reassign), qty larger than the line, non-OPEN PO, date before the order date -> 422. A failed change leaves the PO untouched. New PO numbers continue the tenant's block (ACME after PO-1300) and never reuse an id.

## Idempotency and chaos (TC-08 / TC-09)
- Same key + same body -> the first response is replayed (`Idempotent-Replayed: true`), nothing is applied again. Business-rule failures are replayed too.
- 409 `CONFLICT` cases, told apart by `error.details.reason`:
  - `IN_FLIGHT` - same key, first call still running. Retry later (`Retry-After: 5`).
  - `KEY_REUSED` - key already used for a different PO/body. Permanent; do not retry.
  - `RESET_DURING_REQUEST` - `_reset` ran while the call hung; nothing was applied and the key is free again.
- Chaos `timeout`: PATCH hangs `delay_seconds` (default 35 s), **then applies the write**. The caller has timed out but the ERP did the work - the realistic case. A retry with the same key gets 409 while it hangs, then the stored result. It never updates twice.
- Chaos `500`: PATCH fails with no write; the key is released, so a retry with the same key runs normally once chaos is `off`.
- Reads are never affected. The hang is an async sleep, so it holds no worker thread (`/health` and reads stay responsive).
- **U-10 must reuse the same `execution_id` as the key on retry.** A new key on retry would apply a SPLIT twice.

## Request log (TC-06)
Every `/erp/*` call is logged with method, path, query, tenant, correlation id, idempotency key, status, body (PATCH) and `write_applied`. TC-06 check: `GET /erp/_requests?method=PATCH&po_id=PO-1001` -> no entry with `write_applied: true` (`po_id` matches exactly). The log keeps the last 10,000 calls. `status` stays null while a call is hung, and also if the client disconnected before the response.

## Open items for teammates / S-01
- Uday: add the compose service above to `docker-compose.yml`, and a root `.dockerignore` (`.git`, `node_modules`, `.venv`, `frontend`) so the build context stays small.
- S-01: chaos 500 uses error code `INTERNAL_ERROR`, which is not in the CONTRACTS s1 list - propose adding it (500, "unexpected server error").
- S-01: `X-Tenant-ID` header and the PATCH body above should be written into CONTRACTS s5.
