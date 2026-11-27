# SG_Disruption_Correlate - BUILD SPEC (N-08)

Status: **spec only, nothing built in Boomi.** Written 2026-11-27 against the U-07 branch (`origin/uday/U-07-boomi-erp-read`), the U-08 build log in `tasks/UDAY.md`, and the real U-06 / N-07 / N-10 Django code on this branch. Items marked **(verify)** come from memory of the Boomi UI; if the UI differs, change the step, not the contract. Format follows `boomi/processes/README.md` on the U-07 branch (shared steps S1..S6, error templates E1..E3, `SG_` prefix, folder `SupplyGuard`, Notify log lines with `cid=` first).

Pipeline analogy: this process is one ETL job. Extract = reads from the ERP (one per source table); Transform = assemble one JSON "snapshot" (the staging record); Load = one POST that makes Django compute impact and create the case. Everything after the load (the agents) is a separate job, see section 5.

## 0. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| D1 | **Agents are run by Django (option b)**, not by Boomi Agent Steps. N-08 only creates the case. | The agents need the case's own `impact` (computed in Django, not in the POST response) and `analysis_round`; re-analysis after a rejection (REJECTED -> ANALYZING) starts inside Django; an Agent Step needs an Agent Control Tower account nobody has yet; it keeps the 5 s demo path free of LLM latency. Detail in section 5. |
| D2 | **Entry = Data Passthrough start**, called by Uday's `SG_Subscribe_Disruption` with a Process Call (U-08 option A: N-08 runs in Uday's account on runtime ESI-PC28). A thin wrapper `SG_Disruption_Correlate_Entry` (WSS listener) exposes the same process over HTTP for tests, U-08 option B and the `SG_Disruption_Direct` fallback. | One account, one runtime, no network hop. |
| D3 | **ERP reads go through HTTP Client calls to the U-07 listeners** (localhost), not Process Call. | U-07 processes start with a Web Services Server listener; a Process Call target must start with a Data Passthrough / No Data start **(verify)**. If Uday also exposes Data Passthrough variants, switch the four calls to Process Call (section 2 says what changes). |
| D4 | Inventory and alternates are **per item**, so N-08 loops once per distinct `item_id` over the OPEN PO lines. | `SG_Get_Inventory` and `SG_Get_Alternate_Suppliers` take one `item_id` each (U-07 specs). |
| D5 | A U-07 error aborts the run (no partial snapshot). An **empty** list is data, not an error. | A failed inventory read turned into "no inventory" would understate risk; a genuine `count: 0` is already reported by the engine as a data-quality flag. |
| D6 | Never create a second correlation id; the tenant comes from the event plus the API key only. | CONTRACTS s1. |

## 1. What U-07 must expose (the contract N-08 is built against)

This is what the U-07 branch already specifies, listed so Uday can confirm or correct it before N-08 is wired.

| Process | WSS operation / URL (confirm) | Request body | Success body | Notes |
|---|---|---|---|---|
| `SG_Get_Supplier` | `SG_WSS_GetSupplier`, POST `/ws/simple/create<Object>` **(verify exact path)** | `{correlation_id, tenant_id, supplier_id}` | `{correlation_id, supplier:{supplier_id, tenant_id, name, tax_id, category, city, country, status, risk_level, on_time_delivery_pct, quality_score, capacity_per_week, contact_email, disruption_history[]}}` | unknown supplier -> error body `NOT_FOUND` |
| `SG_Get_Open_POs_By_Supplier` | `SG_WSS_GetOpenPOsBySupplier` | `{correlation_id, tenant_id, supplier_id}` | `{correlation_id, count, results:[PO]}`; PO = `{po_id, tenant_id, supplier_id, order_date, expected_date, status, amount{amount,currency}, lines[{line_no,item_id,item_name,qty,due_date,unit_price{amount,currency}}]}` | status fixed to OPEN; none = `count:0, results:[]` (HTTP 200) |
| `SG_Get_Inventory` | `SG_WSS_GetInventory` | `{correlation_id, tenant_id, item_id}` | `{correlation_id, count, results:[{tenant_id, item_id, item_name, location_id, on_hand, reserved, safety_stock, daily_demand}]}` | unknown item = `count:0` |
| `SG_Get_Alternate_Suppliers` | `SG_WSS_GetAlternateSuppliers` | `{correlation_id, tenant_id, item_id}` | `{correlation_id, count, results:[{tenant_id, item_id, supplier_id, qualified, lead_time_days, unit_price{amount,currency}, capacity}]}` | `capacity: null` stays `null`; `qualified=true` is fixed inside |
| error body (all four) | - | - | `{"error":{"code","message","details","correlation_id"}}` returned with **HTTP 200** | Listener limits found in U-08: no HTTP status, no inbound headers. **N-08 must test for the `error` key**, not the status. `code` in `VALIDATION_ERROR`, `NOT_FOUND`, `DOWNSTREAM_ERROR`, `DOWNSTREAM_TIMEOUT` |

What N-08 needs from Uday beyond the specs (also in the README "Open questions"):
1. The four real listener URLs (the path of each `create<Object>`), the runtime host/port (known: `http://ESI-PC28.easystepin.com:9090`; same runtime, so `http://localhost:9090` works) and the Basic credential N-08 may use (Shared Web Server user; a separate one for Boomi-to-Boomi calls is cleaner than the Django one).
2. Confirmation that the request `correlation_id` is echoed in the response and that the ERP gets `X-Tenant-ID` = request `tenant_id`.
3. Optional, saves the loop (D4): a batch variant taking `item_ids[]` for inventory and alternates. Not required (section 7).
4. Optional: Data Passthrough variants of the four processes (D3).
5. `shipments` (mock ERP `GET /erp/shipments`) is not covered by U-07. N-08 omits `snapshot.shipments`; the key is optional in Django.

## 2. Components (folder `SupplyGuard`, all names start `SG_`)

| Kind | Name | Notes |
|---|---|---|
| Process | `SG_Disruption_Correlate` | Start = Data Passthrough. Input: event JSON |
| Process | `SG_Disruption_Correlate_Entry` | WSS listener `SG_WSS_createCorrelation` (Create/POST) -> Process Call `SG_Disruption_Correlate`; returns `{correlation_id, risk_case_id, case_status, outcome}`. For tests, option B and the Direct fallback |
| Profile (JSON) | `SG_JSON_Correlate_Event` | = `boomi/processes/event_streams/profiles/SG_Event_Disruption.json` (10 fields, CONTRACTS s3). Reuse Uday's `SG_JSON_Event_Disruption` if it is in the same account |
| Profile (JSON) | `SG_JSON_Get_Request` | request of the four reads; reuse Uday's profile of the same name |
| Profiles (JSON) | `SG_JSON_Get_Supplier_Response`, `SG_JSON_Get_Open_POs_Response`, `SG_JSON_Get_Inventory_Response`, `SG_JSON_Get_Alternates_Response` | import from `boomi/processes/profiles/SG_Get_*.response.json` on the U-07 branch |
| Profile (JSON) | `SG_JSON_Snapshot_Request` | body of the Django POST (sample in 4.3) |
| Profile (JSON) | `SG_JSON_Case_Response` | response of Django (sample = 201 body in 4.5) |
| Profile (JSON) | `SG_JSON_Error` | reuse U-07 `SG_Error.response.json` |
| Connection | `SG_HTTP_ERPRead` | HTTP Client, URL default `http://localhost:9090`, auth Basic (extension). For the four U-07 calls. Connection quota in Uday's account is 3 Standard + 2 Test (U-07 README): this and `SG_HTTP_Django` are two more; check the budget first |
| Connection | `SG_HTTP_Django` | HTTP Client, URL default `http://localhost:8000`, auth None (custom header) |
| HTTP operations | `SG_HTTP_POST_GetSupplier`, `SG_HTTP_POST_GetOpenPOs`, `SG_HTTP_POST_GetInventory`, `SG_HTTP_POST_GetAlternates` | POST, JSON, request/response profiles as above, path = the listener path |
| HTTP operation | `SG_HTTP_POST_RiskCase` | POST `/api/v1/internal/risk-cases`, request `SG_JSON_Snapshot_Request`, response `SG_JSON_Case_Response`; request headers `X-Api-Key`, `X-Correlation-ID`, `Idempotency-Key`, `Content-Type`, `Accept`; Return HTTP errors ON **(verify)** |
| Document Cache | `SG_DC_Inventory`, `SG_DC_Alternates` | index `item_id`; duplicates not allowed |
| Process Property | `SG_PP_Correlate` | extension values, section 8 |
| Scripts (Data Process, Groovy) | `SG_GRP_Classify`, `SG_GRP_ItemIds`, `SG_GRP_BuildSnapshot` | sections 3-4 |

If D3 is reversed: the four HTTP shapes become Process Call shapes to the same process names; profiles unchanged.

## 3. Shape by shape: trigger and fetch

Dynamic Process Properties (DPPs): `DPP_CID`, `DPP_TENANT_ID`, `DPP_EVENT_ID`, `DPP_SUPPLIER_ID`, `DPP_T0` (start epoch ms), `DPP_SUPPLIER_JSON`, `DPP_POS_JSON`, `DPP_INV_JSON`, `DPP_ALT_JSON`, `DPP_ITEM_COUNT`, `DPP_OUTCOME`, `DPP_ERR_CLASS`.

| # | Shape | Configuration |
|---|---|---|
| 1 | **Start** (Data Passthrough) | Input = event JSON (`SG_JSON_Correlate_Event`), unchanged from topic `supplier.disruption` / CONTRACTS s3. A Process Call also carries the caller's DPPs. |
| 2 | **Set Properties "Init"** | `DPP_CID` = event `correlation_id` (empty: keep the caller's DPP; still empty: Unique Id and log a WARN; only the publisher may invent one, U-08 README s4). `DPP_TENANT_ID`, `DPP_EVENT_ID`, `DPP_SUPPLIER_ID` from the event. `DPP_T0` = `System.currentTimeMillis()` (Groovy in `SG_GRP_Classify`). |
| 3 | **Notify** INFO | `SG_Disruption_Correlate start cid=<DPP_CID> tenant=<DPP_TENANT_ID> event=<DPP_EVENT_ID>`. Never the body or a key. |
| 4 | **Decision "Event valid?"** | `event_id` matches `^EVT-[0-9]+$`, `tenant_id` matches `^TEN-[A-Z0-9]+$`, `supplier_id` matches `^SUP-[0-9]+$` (regex via a Data Process Groovy step, as U-07 S2a). False -> error E3 (section 6), no outbound call. |
| 5 | **Try/Catch** (outer) | wraps shapes 6-24. Catch -> section 6 path C. |
| 6 | **Message "read request: supplier"** | `{"correlation_id":"{1}","tenant_id":"{2}","supplier_id":"{3}"}`, `{1}`=`DPP_CID`, `{2}`=`DPP_TENANT_ID`, `{3}`=`DPP_SUPPLIER_ID`. |
| 7 | **Connector** `SG_HTTP_ERPRead` + `SG_HTTP_POST_GetSupplier` | response profile `SG_JSON_Get_Supplier_Response`. Connect 5 s, read 10 s. No retry. |
| 8 | **Data Process** `SG_GRP_Classify`, then **Decision "Has error key?"** | Groovy: top-level `error` present -> DDP `SG_ERR_CODE` = `error.code`. True and `NOT_FOUND` -> **supplier-missing branch**: `DPP_SUPPLIER_JSON` = `null`, `DPP_POS_JSON` = `[]`, jump to shape 17 (Django flags the event and returns `{risk_case_id:null, flagged:true}`). True and any other code -> path A. False -> continue. |
| 9 | **Set Properties** | `DPP_SUPPLIER_JSON` = the `supplier` object only (Groovy extracts `.supplier`; ~1 KB, fine in a DPP). |
| 10 | **Message "read request: POs"** | same three fields as shape 6. |
| 11 | **Connector** `SG_HTTP_ERPRead` + `SG_HTTP_POST_GetOpenPOs` | response profile `SG_JSON_Get_Open_POs_Response`. |
| 12 | `SG_GRP_Classify` + **Decision "Has error key?"** | any error -> path A. |
| 13 | **Decision "count = 0?"** | True: `DPP_POS_JSON` = `[]`, `DPP_ITEM_COUNT` = 0, jump to shape 17 (Django answers `{risk_case_id:null, no_impact:true}`: a normal end). False: continue. |
| 14 | **Set Properties** | `DPP_POS_JSON` = `results` array (Groovy). Demo-scale payloads (TC-03: 6 POs, ~6-10 KB) are fine in a DPP. |
| 15 | **Data Process** `SG_GRP_ItemIds` | Groovy: from `results[].lines[].item_id` emit **one document per distinct item_id**, body `{"correlation_id","tenant_id","item_id"}`; set `DPP_ITEM_COUNT`; if the count exceeds `item_loop_max` raise error class VALIDATION. Use all open-PO lines, not only those Django will call "affected": Django decides that from the outage window, N-08 does not duplicate the logic. |
| 16 | **Branch** (2 paths; Boomi runs each path over the whole batch, one path after the other) | path 1 inventory, path 2 alternates. |
| 16a | Path 1: **Connector** `SG_HTTP_ERPRead` + `SG_HTTP_POST_GetInventory` -> `SG_GRP_Classify` -> Decision "Has error key?" (error -> path A) -> **Data Process Split** `results[]` into one document per row -> **Add to Document Cache** `SG_DC_Inventory` -> **Stop** | one call per item |
| 16b | Path 2: **Connector** `SG_HTTP_ERPRead` + `SG_HTTP_POST_GetAlternates` -> classify -> **Split** `results[]` -> **Add to Document Cache** `SG_DC_Alternates` -> **Stop** | `capacity: null` must stay null (no coercion in Groovy or maps) |

Why a cache: the per-item calls create many small documents; the cache lets the next step read them as one set (a staging table joined later). If Document Cache is unavailable **(verify)**, fall back to one Groovy step that loops with `HttpURLConnection` and builds the arrays in memory; the snapshot is identical.

**Parallel option.** To cut wall time replace Branch 16 with a **Flow Control** shape (2 threads) **(verify)**. Do this only if the section 7 measurement misses the budget.

## 4. Shape by shape: snapshot and case

### 4.1 Retrieve and assemble

| # | Shape | Configuration |
|---|---|---|
| 17 | **Message "resume"** (the stream is one document again after the Branch, or after a jump from shape 8/13) | `{"correlation_id":"{1}"}` |
| 18 | **Load from Document Cache** `SG_DC_Inventory` (all) -> **Combine Documents** (JSON array) -> **Set Properties** `DPP_INV_JSON`; the same for `SG_DC_Alternates` -> `DPP_ALT_JSON` | empty cache -> `[]` |
| 19 | **Data Process** `SG_GRP_BuildSnapshot` (Groovy) | Reads `DPP_SUPPLIER_JSON`, `DPP_POS_JSON`, `DPP_INV_JSON`, `DPP_ALT_JSON`, `DPP_EVENT_ID`; emits ONE document = the POST body (4.3). Rules: emit **only** the allowed keys (4.2), Django rejects unknown snapshot keys with 400; drop the `correlation_id` and `count` envelope fields; copy values **as received** (money stays `{"amount":"..","currency":".."}` strings, dates stay strings, `capacity` null stays null, integers stay numbers); `captured_at` = now, UTC, `yyyy-MM-dd'T'HH:mm:ss'Z'`. |
| 20 | **Notify** | `snapshot cid=.. event=.. pos=<n> inv=<n> alt=<n>` (counts only). |

### 4.2 What Django accepts (read from `backend/apps/integrations/callback_serializers.py` and `snapshot_checks.py`)

`POST /api/v1/internal/risk-cases`, SYSTEM role only. Body `{event_id, snapshot}`. Allowed snapshot keys: `captured_at` (required, timezone-aware ISO), `supplier` (object or null), `purchase_orders[]`, `inventory[]`, `alternate_suppliers[]`, `shipments[]`, `supplier_history[]` (lists optional, max 5000 rows, rows are objects). Unknown key -> 400. Duplicate `po_id` -> 400. Tenant ids inside rows must equal the key's tenant. Text over the DB limits (ids 40, item name 200) and numbers or money out of range -> 400 (nothing is written).

### 4.3 Field-by-field mapping (U-07 output -> snapshot)

| Snapshot field | Source | Rule |
|---|---|---|
| `event_id` (body, outside the snapshot) | event `event_id` | exact |
| `snapshot.captured_at` | clock | UTC ISO-8601 with `Z` |
| `snapshot.supplier` | `SG_Get_Supplier.supplier` | whole object 1:1 (`supplier_id, tenant_id, name, tax_id, category, city, country, status, risk_level, on_time_delivery_pct, quality_score, capacity_per_week, contact_email, disruption_history[]`); `null` when the ERP answered `NOT_FOUND` |
| `snapshot.purchase_orders[]` | `SG_Get_Open_POs_By_Supplier.results[]` | each PO 1:1 incl. `lines[]` and money objects |
| `snapshot.inventory[]` | union of `SG_Get_Inventory.results[]` over all items | rows 1:1 (`tenant_id, item_id, item_name, location_id, on_hand, reserved, safety_stock, daily_demand`); do not compute available stock |
| `snapshot.alternate_suppliers[]` | union of `SG_Get_Alternate_Suppliers.results[]` over all items | rows 1:1 (`tenant_id, item_id, supplier_id, qualified, lead_time_days, unit_price{amount,currency}, capacity`); `capacity` null stays null |
| `snapshot.shipments` | not fetched | omit the key |
| `snapshot.supplier_history` | not fetched | omit the key (history is inside `supplier.disruption_history`) |
| dropped | `correlation_id`, `count` of each U-07 envelope | not part of the snapshot |

Body sample (illustrative values; the real ones come from the ERP at run time, the demo must produce exposure `491400.00 INR` and 2 affected POs):
```json
{
  "event_id": "EVT-000123",
  "snapshot": {
    "captured_at": "2026-12-02T10:15:02Z",
    "supplier": {"supplier_id": "SUP-1008", "tenant_id": "TEN-ACME", "name": "...", "capacity_per_week": null, "disruption_history": []},
    "purchase_orders": [{"po_id": "PO-1001", "tenant_id": "TEN-ACME", "supplier_id": "SUP-1008", "status": "OPEN",
      "expected_date": "2026-12-03", "amount": {"amount": "420000.00", "currency": "INR"},
      "lines": [{"line_no": 1, "item_id": "ITM-501", "item_name": "...", "qty": 500, "due_date": "2026-12-03",
                 "unit_price": {"amount": "84.00", "currency": "INR"}}]}],
    "inventory": [{"tenant_id": "TEN-ACME", "item_id": "ITM-501", "location_id": "LOC-01", "on_hand": 120,
                   "reserved": 20, "safety_stock": 50, "daily_demand": 40}],
    "alternate_suppliers": [{"tenant_id": "TEN-ACME", "item_id": "ITM-501", "supplier_id": "SUP-2001", "qualified": true,
                   "lead_time_days": 2, "unit_price": {"amount": "84.00", "currency": "INR"}, "capacity": 400}]
  }
}
```

### 4.4 The Django call

| # | Shape | Configuration |
|---|---|---|
| 21 | **Set Properties "Django headers"** | Request headers of `SG_HTTP_POST_RiskCase`: `X-Api-Key` = `SG_PP_Correlate.django_api_key` (Password-type extension; a `sgk_...` SYSTEM key bound to the tenant); `X-Correlation-ID` = `DPP_CID`; `Idempotency-Key` = `<DPP_TENANT_ID>:<DPP_EVENT_ID>` (Django ignores it today, harmless, kept for symmetry with U-06); `Content-Type`, `Accept` = `application/json`. **No tenant is sent**: Django takes it from the key. An event of another tenant than the key's gets 404 (Django cannot see it). |
| 22 | **Connector** `SG_HTTP_Django` + `SG_HTTP_POST_RiskCase` | connect 3 s, read 8 s. **Retry** (Try/Catch retry count 2, waits 1 s and 2 s) on this call only and only for connection errors, timeouts, 429, 502, 503, 504: the endpoint is idempotent per `event_id` (a repeat returns 200 with the same case). Never retry other 4xx. |
| 23 | **Decision on HTTP status** (DDP Connector > HTTP Status Code; if the connector throws instead, read the code from the Try/Catch message, as U-07 "Two possible behaviours") | table 4.5 |
| 24 | **Notify**, then end / Return Documents | `SG_Disruption_Correlate done cid=.. tenant=.. event=.. http=<code> case=<id|none> outcome=<..> ms=<now-DPP_T0>`. The entry wrapper returns `{correlation_id, risk_case_id, case_status, outcome}`. |

### 4.5 Django responses and what N-08 does (read from `risk_cases.py` and `views.py`)

| HTTP | Body | Meaning | N-08 action | `outcome` |
|---|---|---|---|---|
| 201 | `{risk_case_id, status:"ANALYZING", risk_level, risk_score, exposure{amount,currency}, affected_po_count, data_quality_flags[], correlation_id}` | new case, already moved RECEIVED -> ANALYZING | success, log, end | `CASE_CREATED` |
| 200 | same body, existing case | duplicate or redelivered event (U-08: "treat 200 as already started") | success, log `duplicate`, end | `CASE_EXISTS` |
| 200 | `{risk_case_id:null, no_impact:true}` | valid event, no affected PO line | success, **no case**, end | `NO_IMPACT` |
| 200 | `{risk_case_id:null, flagged:true}` | supplier missing in the snapshot, event flagged for data correction | success, no case, end | `FLAGGED` |
| 400 | error body `VALIDATION_ERROR` | snapshot rejected (unknown key, range, duplicate PO) | no retry, path B, class VALIDATION | `FAILED_VALIDATION` |
| 401 / 403 | `UNAUTHENTICATED` / `FORBIDDEN` | key wrong, disabled, or wrong role | no retry, path B, class AUTH, alert (config error) | `FAILED_AUTH` |
| 404 | `NOT_FOUND` | event unknown or of another tenant | **final, no retry**, path B, class NOT_FOUND; typical cause: event published to the topic without Django intake, or the key of the wrong tenant | `FAILED_NOT_FOUND` |
| 409 | `CONFLICT` "event is flagged for data correction" | event already flagged (e.g. TC-02) | final, no retry, log only, **not** an alert | `EVENT_FLAGGED` |
| 429 | `RATE_LIMITED` | throttled | transient, retried (shape 22) | - |
| 5xx, timeout, refused | - | Django down | retried, then path B, class DOWNSTREAM (timeout: TRANSIENT) | `FAILED_DOWNSTREAM` |

## 5. Agent invocation (the hand-off to N-09)

### The two options

| | (a) Boomi Agent Steps in N-08, then post to `/analysis` | (b) Django runs the agents via N-09 `AnalysisTrigger` (`AGENT_BACKEND=boomi\|claude\|mock`); Boomi only creates the case |
|---|---|---|
| Where the agents run | Boomi calls Agent Garden: `SG Supplier Risk Analyst` (id `fa1f773c-b314-4cf5-ab69-44b999467cd3`, prompt v1.3.0, **not deployed**, draft) and `SG Recovery Planner` (id `b5f2f51a-0b4e-41e6-998d-e04031f2a9d0`, deployment `1142f95b-7b4a-466f-a895-89a2140068ac`, Agent Garden Production) | Django calls the same agents through the Agent Garden API for `AGENT_BACKEND=boomi`; Claude API for `claude`; fixtures for `mock` |
| Prerequisite | Agent Control Tower account + Agent Step in Integration (note in `boomi/agents/recovery_planner/README.md`: not done yet); agents reachable from the account that runs N-08 (both live in Uday's account) | Agent Garden API credentials in Django `.env`, only for `boomi` |
| Input the agents need | `agent_input.schema.json`: event, snapshot, **`impact`**, `data_quality_flags`. `impact` is computed by Django (N-04) and is **not** in the 201 body, so Boomi would need a new internal read endpoint | Django already has case, impact and snapshot ("N-09 must feed the agents the case's own impact", N-07 note) |
| Round / re-analysis | Boomi must send `round` = the case's `analysis_round` (not in the 201 body). A REJECTED -> ANALYZING re-run starts inside Django, so a second trigger path from Django to Boomi is needed anyway | the same `AnalysisTrigger` serves the first run and every re-analysis round |
| Persistence | Boomi POSTs the Risk Analyst output, then the Recovery Planner output to `POST /api/v1/internal/risk-cases/{id}/analysis` (`{kind, payload, round}`; 201 done, 422 invalid -> re-ask once, 409 final) | Django calls `record_analysis()` in-process |
| Demo timing | two LLM calls (5-20 s each) inside the Boomi process; the < 10 s acceptance would have to be measured before them | not in the N-08 path; case exists ~2 s after the event, the analysis lands later and the UI shows ANALYZING |
| Offline / quota | no fallback if Agent Control Tower or the model is down | `claude` and `mock` fallbacks, same schemas (CONTRACTS s8) |
| Who | Uday's account + ACT + backend endpoint | N-09 backend session; no extra Boomi work |

### Recommendation: (b)

Reasons: (1) the agents' input needs Django's `impact` and `analysis_round`, which only Django holds, and (a) forces a new internal endpoint plus a second trigger for re-analysis; (2) the 5 s and 10 s budgets stay measurable because the LLM is outside the path; (3) `AGENT_BACKEND` already gives the offline fallback; (4) Agent Control Tower is not set up and is a hard prerequisite of (a). Boomi Agentstudio is still shown: with `AGENT_BACKEND=boomi` the N-05/N-06 agents answer.

Consequences:
- N-08 ends at the Django 201/200. No Agent Step, no `/analysis` call in this process. The spec for (a) is kept in the appendix.
- **The one dependency on N-09 (backend, not touched here):** today `/internal/risk-cases` moves the case to ANALYZING and queues **no** analysis request (U-06 note: "N-08 must start the agents itself"; `AnalysisTrigger` fires only for REJECTED -> ANALYZING). For (b) the trigger must also fire on case **creation**: either `create_risk_case_from_snapshot` calls `get_analysis_trigger().request_analysis(...)` after `move_to_analyzing()` (small edit in Uday's file, he must agree), or `transition()` queues it on every entry into ANALYZING. Until then a created case sits in ANALYZING without agents.

## 6. Error handling and correlation

Correlation id: `DPP_CID` comes from the event and goes on every outbound call: in the body `correlation_id` to the four reads (U-07 listeners give no headers, so body only) and in header `X-Correlation-ID` to Django. Django's 201/200 body returns `correlation_id`; N-08 compares it with `DPP_CID` (mismatch: WARN, keep Django's). Every Notify line starts `cid=`. Never log keys, headers or bodies.

| Path | Trigger | Action |
|---|---|---|
| E3 (validation) | shape 4 false | Message `{"error":{"code":"VALIDATION_ERROR","message":"event invalid","details":{"field":"<f>"},"correlation_id":"{1}"}}`; Notify; end. No retry and no dead letter (it can never succeed), only a log row. |
| A (ERP read failed) | an `error` key from any U-07 process, or an exception on the four calls | `DPP_ERR_CLASS` from the code: `VALIDATION_ERROR` -> VALIDATION, `DOWNSTREAM_ERROR` -> DOWNSTREAM, `DOWNSTREAM_TIMEOUT` -> TRANSIENT; build E1/E2 (U-07 README); go to D. |
| B (Django rejected) | failures in table 4.5 | error document with Django's `error.code`; go to D. |
| C (Catch) | outer Try/Catch: any other exception (script bug, runtime) | `DPP_ERR_CLASS` = DOWNSTREAM; message sanitised (first 200 chars, never the body); go to D. |
| D (dead letter, U-11) | A, B, C | Route the **original event document**, `DPP_ERR_CLASS`, `DPP_CID`, `DPP_TENANT_ID`, `DPP_EVENT_ID` to U-11's error process (name from U-11, **(verify)** with Uday; extension `dead_letter_process`). Until U-11 exists: **Throw Exception** carrying `cid` and class, so the U-08 subscriber's Catch does not acknowledge the message and Event Streams redelivers; this is safe because `/internal/risk-cases` is idempotent. Retryable classes: TRANSIENT, DOWNSTREAM. Non-retryable (VALIDATION, AUTH, NOT_FOUND): dead letter at once, no redelivery loop. |

Class vocabulary = `Execution.error_class` of U-06 (`VALIDATION | AUTH | BUSINESS | TRANSIENT | DOWNSTREAM`, plus NOT_FOUND here, mapped to VALIDATION if U-11 wants the five). The 409 `EVENT_FLAGGED` and the outcomes `FLAGGED` and `NO_IMPACT` are not errors.

## 7. Timing budget

Targets: **< 10 s** from N-08 start to a RiskCase with AffectedPOs (N-08 acceptance) and **< 5 s** from the simulate click to a new case (Roop's demo). Every figure is an **estimate** for a local runtime and local mock ERP, except the Event Streams hop, which is **measured** (U-08: publish to subscriber 2-3 s). Replace with measured values in `boomi/TEST_LOG.md` (section 9).

| Step | Demo (SUP-1008, 3 POs, 1 item) | TC-03 (SUP-1020, 6 POs, 4-5 items) |
|---|---|---|
| Django simulate -> intake -> publish to the listener | 0.3-0.5 s | same |
| `SG_Publish_Event` -> topic -> subscriber starts (**measured 2-3 s**) | 2-3 s | same |
| Subscriber -> Process Call N-08, init, validate | 0.1-0.2 s | same |
| `SG_Get_Supplier` + `SG_Get_Open_POs` (2 HTTP, ~0.2-0.4 s each) | 0.5-0.8 s | 0.5-0.8 s |
| Per item: inventory + alternates (2 HTTP each, Branch is sequential) | 0.6 s | 4-5 items x 0.6 = 2.4-3.0 s (half with Flow Control, 2 threads) |
| Cache load + Groovy assemble | 0.2 s | 0.3 s |
| `POST /internal/risk-cases` (engine, DB, transition) | 0.2-0.4 s | 0.3-0.6 s |
| **N-08 only** | **~1.7-2.2 s** | **~3.8-4.9 s** |
| **Total including the Event Streams hop** | **~4.1-5.7 s** | **~6.2-8.6 s** |

Reading: N-08 alone is far inside 10 s in both cases. The **5 s simulate path is at risk only because of the Event Streams hop** (2-3 s measured). Levers, in order: (1) use `SG_Disruption_Direct` (U-08 fallback: the listener starts the correlation, no topic) for the live demo if the measured total misses 5 s; the cost is that Event Streams is labelled fallback on the slide; (2) Flow Control threads (section 3); (3) Uday's optional batch reads (section 1 item 3); (4) warm the connections with one dummy simulate before the demo (the first call after idle is the slow one). Decision rule: if the demo total exceeds 4.5 s on 3 consecutive runs, use lever 1. The demo scenario (1 item) is the one that has to fit 5 s; TC-03 only needs 10 s.

## 8. Environment extensions

Manage > Environments > Extensions of the environment the runtime is attached to (`BIMBA-OPCUA-Test` unless Uday creates `SG-Dev`). Nothing environment-specific is stored in a component and no secret goes into git.

| Extension | Where | Local value | Hosted (U-12) |
|---|---|---|---|
| ERP read base URL | connection `SG_HTTP_ERPRead` > URL | `http://localhost:9090` (Uday's runtime, same shared web server) | `https://<runtime-or-gateway>` |
| ERP read credentials | connection `SG_HTTP_ERPRead` > user / password | Shared Web Server user for Boomi-to-Boomi calls and its token (generated by the user, never in chat or git) | same |
| ERP read timeouts | connection `SG_HTTP_ERPRead` | connect 5000 ms, read 10000 ms | same |
| Django base URL | connection `SG_HTTP_Django` > URL | `http://localhost:8000` (Django in Docker on the same PC; `host.docker.internal` is only for the other direction) | `https://<django-host>` |
| Django timeouts | connection `SG_HTTP_Django` | connect 3000 ms, read 8000 ms | same |
| Django SYSTEM API key | process property `SG_PP_Correlate.django_api_key` (Password) | `sgk_...` key of tenant `TEN-ACME` | one key per tenant, see note |
| Django path | `SG_PP_Correlate.django_path` | `/api/v1/internal/risk-cases` | same |
| Item loop cap | `SG_PP_Correlate.item_loop_max` | `25` | same |
| Retries | `SG_PP_Correlate.django_retries` | `2` | `2` |
| Dead-letter process | `SG_PP_Correlate.dead_letter_process` | U-11 process name | same |

One API key = one tenant, so the value above serves `TEN-ACME` only. A second demo tenant needs a Decision on `DPP_TENANT_ID` selecting `django_api_key_<tenant>`, or one environment per tenant. A key of the wrong tenant gives 404 (final).

Not extensions but needed: Uday attaches both connections to the environment and deploys `SG_Disruption_Correlate` and `SG_Disruption_Correlate_Entry` as one package.

## 9. Test plan and `boomi/TEST_LOG.md` entries

Prerequisites: U-07 deployed and tested; U-08 hand-off done (or the entry listener used); Django and mock ERP seeded; a `TEN-ACME` API key in the extension; the `DisruptionEvent` exists in Django first (`POST /api/v1/demo/simulate-disruption`), because `/internal/risk-cases` requires it.

Add these rows to `boomi/TEST_LOG.md` (columns: date, who, process, scenario, result, note), all `NOT RUN` at first:

| Process | Scenario | Input | Expected |
|---|---|---|---|
| SG_Disruption_Correlate | **DEMO**: factory outage creates the case | `data/scenarios/demo.json` (EVT-000123, or a fresh `EVT-9xxxxx` from simulate), SUP-1008 | HTTP 201, `ANALYZING`, `affected_po_count` 2 = **PO-1001 and PO-1002** (PO-1003 evaluated, not affected), exposure `491400.00 INR`, in **< 10 s** from N-08 start |
| SG_Disruption_Correlate | **TC-03**: all open POs evaluated | `tc03_multiple_open_pos.json` (SUP-1020) | all 6 open POs fetched (PO-1007..PO-1012 evaluated), 5 affected, exposure `537649.00 INR`; the loop ran once per distinct item (ITM-520..523 and the item of PO-1012) |
| SG_Disruption_Correlate | Simulate -> case < 5 s | simulate click or `POST /demo/simulate-disruption` | case visible in `/risk-cases` within 5 s (section 7 decision rule); record the three timings (publish, subscriber start, case created) |
| SG_Disruption_Correlate | Duplicate event | same event twice (`tc09_duplicate_event`) | 2nd run HTTP 200, same `risk_case_id`, `CASE_EXISTS`, one case |
| SG_Disruption_Correlate | Unknown supplier (TC-02) | `tc02_unknown_supplier.json` | Django does not publish (no Boomi call); if sent straight to the entry listener: supplier `NOT_FOUND` -> `supplier:null` -> `{risk_case_id:null, flagged:true}`, a repeat gives 409; no case |
| SG_Disruption_Correlate | No impact | event whose POs are all outside the window | 200 `no_impact:true`, `NO_IMPACT`, no case |
| SG_Disruption_Correlate | No alternates (input side of TC-05) | `tc05_no_alternates.json` | `alternate_suppliers` empty in the snapshot, case created, data-quality flag present |
| SG_Disruption_Correlate | Inventory sufficient (input side of TC-04) | `tc04_inventory_sufficient.json` | case created, shortage false per engine |
| SG_Disruption_Correlate | ERP down / timeout (TC-08 side) | stop the mock ERP, or point `SG_HTTP_ERPRead` at a blackhole URL (as U-07's plan) | path A, class DOWNSTREAM or TRANSIENT, no Django call, message not acknowledged or dead-letter row, correct `cid` in the log |
| SG_Disruption_Correlate | Django down / 5xx | stop Django | 2 retries (1 s, 2 s), then path B DOWNSTREAM; after Django returns, redelivery yields exactly one case |
| SG_Disruption_Correlate | Wrong or missing API key | bad `django_api_key` | 401, no retry, class AUTH, no key in any log line |
| SG_Disruption_Correlate | Key of another tenant | key of `TEN-OTHER` | 404, no retry, NOT_FOUND, nothing created (`tenant_isolation.json`) |
| SG_Disruption_Correlate | Snapshot invalid | doctored ERP reply with a duplicate PO | 400 VALIDATION, no retry, dead letter |
| SG_Disruption_Correlate | correlation id end to end | any run | same `cid` in the event, the four U-07 log lines, N-08 lines, Django `X-Correlation-ID` and audit rows |
| SG_Disruption_Correlate | Malformed event | `tenant_id` = `acme` | E3, no outbound call |
| SG_Disruption_Correlate_Entry | Entry listener round trip | POST the `demo.json` event | `{correlation_id, risk_case_id, case_status:"ANALYZING", outcome:"CASE_CREATED"}` |

Tick the N-08 acceptance boxes from the first two rows only.

## 10. Build order for the day U-07 lands (about 3-4 h)

1. Get from Uday: the four listener URLs, a Basic credential, confirmation that `SG_Get_*` are deployed and tested.
2. Create connections, operations, profiles, process properties, set extensions (sections 2, 8).
3. Build the happy path only (shapes 1-3, 6-15, 16a/16b, 17-22) and run the DEMO row.
4. Add classification, paths A-D, the retry, the entry wrapper; run the remaining rows.
5. Export the components to `boomi/processes/correlation/export/` (check `grep -ri "sgk_\|password" export` is clean), tell Uday the process name for the subscriber Process Call, update TEST_LOG.

## Appendix: option (a), in case the team chooses it later

After shape 22 returns 201: (1) read the case: needs a **new** internal read endpoint returning `impact`, `analysis_round`, `data_quality_flags` (not present, backend change); (2) Message `agent_input` per `ai/schemas/agent_input.schema.json` (`agent: RISK_ANALYST`), **Agent Step** -> Risk Analyst (needs the Agent Control Tower account and a deployed v1.3.0); (3) POST `/api/v1/internal/risk-cases/{id}/analysis` with `{kind:"RISK_ANALYSIS", payload, round}` and `X-Api-Key`: 201 continue, 422 re-ask once then dead-letter, 409 stop; (4) Message `agent_input` for `RECOVERY_PLANNER` including `risk_analysis`, Agent Step -> Recovery Planner, POST with `kind:"RECOVERY_PLAN"`. Timeout per agent 30 s. The case moves to PENDING_APPROVAL inside Django when the plan is recorded (CLOSED for TC-05). Re-analysis after a rejection would still need Django to call Boomi, so (a) never removes the Django-side trigger.
