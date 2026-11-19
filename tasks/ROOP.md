# Tasks - Roop (Team Lead · Integration & Platform)

**Stream:** Boomi Integration, Event Streams, API Management, mock ERP, event intake + execution in Django, deployment, Marketplace package.
**Owns:** `boomi/`, `mock-erp/`, `data/`, `backend/apps/integrations/`, `deploy/`, `docs/BOOMI_ENV.md`, `docs/INSTALL.md`
**Lead duties:** owns `docs/CONTRACTS.md` freeze (S-01), reviews PRs into `collaboration`, merges `collaboration` -> `main` at each milestone.

> Status values: `todo` · `in-progress` · `blocked` · `review` · `done`. Only change the `Status`, `Done in`, checkboxes and Notes lines - keep the format, `scripts/progress.py` parses it.
> Model hint = what the advisor (Opus 5.5) should delegate the bulk of the work to. See `docs/AI_WORKFLOW.md`.

## Handoff
<!-- Overwrite this block at the end of EVERY session (run /handoff). Newest state only; history goes to progress/SESSION_LOG.md -->
- **Last updated:** 2026-11-19 (setup)
- **Current task:** -
- **Branch:** -
- **Where I left off:** Project structure and task split created. Nothing implemented yet.
- **Next step:** Start R-01 (Boomi environment check) and S-01 (freeze contracts with team).
- **Blockers:** none

---

### R-01: Boomi environment and service verification
- **Status:** todo
- **Sprint:** S0 (19-23 Nov) | **Est:** 1d | **Depends:** -
- **Branch:** `roop/R-01-boomi-env`
- **Model hint:** haiku / low (checklist + docs), you do the Boomi UI clicks
- **Deliverables:** `docs/BOOMI_ENV.md` - account ID, environments, runtime (cloud atom / local atom), which of Integration, Event Streams, Agentstudio, Flow, API Management, Data Hub are enabled, team member access, chosen fallbacks (CONTRACTS section 8).
- **Acceptance:**
  - [ ] All 6 services checked and recorded as enabled / not enabled
  - [ ] Nikhil and Uday have Boomi platform access
  - [ ] Fallback decision recorded for every missing service
- **Done in:** -
- **Notes:** -

### R-02: Mock ERP service
- **Status:** todo
- **Sprint:** S0 (19-23 Nov) | **Est:** 2d | **Depends:** S-01
- **Branch:** `roop/R-02-mock-erp`
- **Model hint:** sonnet / medium
- **Deliverables:** `mock-erp/` FastAPI app (Python 3.12) implementing CONTRACTS section 5, loads `data/seed/*.json`, in-memory store with reset endpoint, `Idempotency-Key` enforcement on PATCH, chaos endpoint, Dockerfile, pytest tests.
- **Acceptance:**
  - [ ] All endpoints in CONTRACTS section 5 respond with seed data
  - [ ] Same `Idempotency-Key` twice -> second call returns first result, no double update
  - [ ] `_chaos timeout` makes PATCH hang > 30 s; `off` restores
  - [ ] `docker compose up mock-erp` works
- **Done in:** -
- **Notes:** -

### R-03: Synthetic demo dataset
- **Status:** todo
- **Sprint:** S0 (19-23 Nov) | **Est:** 1d | **Depends:** S-01
- **Branch:** `roop/R-03-seed-data`
- **Model hint:** sonnet / medium (generator script), haiku to sanity-check
- **Deliverables:** `data/generate_seed.py` (deterministic, seeded RNG) -> `data/seed/{tenants,suppliers,purchase_orders,inventory,alternate_suppliers,shipments}.json`; 2 tenants (TEN-ACME, TEN-GLOBEX), 100 suppliers, 500 POs, 3 locations, 20 active shipments; `data/scenarios/*.json` canonical events for TC-01..TC-09 and the demo (SUP-1008 factory outage, 48 h).
- **Acceptance:**
  - [ ] Demo scenario yields exactly the numbers documented in `data/README.md` (affected POs, exposure, 2 alternates)
  - [ ] TC-04 scenario has enough inventory to cover the delay; TC-05 scenario has no alternates
  - [ ] Uday's seed loader (U-02) and mock ERP both load the same files
- **Done in:** -
- **Notes:** -

### R-04: Boomi ERP read processes + canonical profiles
- **Status:** todo
- **Sprint:** S1 (24-30 Nov) | **Est:** 3d | **Depends:** R-01, R-02
- **Branch:** `roop/R-04-boomi-erp-read`
- **Model hint:** sonnet / medium (use the boomi-integration skill if installed); opus / high for mapping design review
- **Deliverables:** Boomi processes `SG_Get_Supplier`, `SG_Get_Open_POs_By_Supplier`, `SG_Get_Inventory`, `SG_Get_Alternate_Suppliers`; JSON profiles matching CONTRACTS; HTTP Client connection to mock ERP (URL from environment extension). Exported component XML/notes in `boomi/processes/`, test runs in `boomi/TEST_LOG.md`.
- **Acceptance:**
  - [ ] Each process test-run in Boomi returns canonical JSON
  - [ ] Connection URL and credentials are environment extensions (no hard-coding)
  - [ ] Exports committed under `boomi/`
- **Done in:** -
- **Notes:** -

### R-05: Event Streams topics + disruption subscriber
- **Status:** todo
- **Sprint:** S1 (24-30 Nov) | **Est:** 2d | **Depends:** R-01, R-04
- **Branch:** `roop/R-05-event-streams`
- **Model hint:** sonnet / medium
- **Deliverables:** topics `supplier.disruption`, `shipment.delay`, `recovery.status`; publisher process; subscriber process that runs correlation (R-07). If Event Streams unavailable, fallback from CONTRACTS section 8.
- **Acceptance:**
  - [ ] Publishing a canonical event triggers the subscriber within 2 s
  - [ ] `correlation_id` preserved end to end
- **Done in:** -
- **Notes:** -

### R-06: Django integrations app - event intake + Boomi client
- **Status:** todo
- **Sprint:** S1 (24-30 Nov) | **Est:** 2d | **Depends:** U-01, U-02, U-03
- **Branch:** `roop/R-06-event-intake`
- **Model hint:** sonnet / medium; opus / high review for idempotency + tenant check
- **Deliverables:** `backend/apps/integrations/`: `POST /events/disruptions`, `POST /demo/simulate-disruption`, API-key auth for `SYSTEM`, duplicate detection on `event_id`, `BoomiClient` (httpx, timeout, bounded retry with backoff on transient errors only), publishes to Boomi; `GET /integrations/status`.
- **Acceptance:**
  - [ ] TC-01: valid event -> 202 + correlation_id, DisruptionEvent stored, Boomi called
  - [ ] TC-02: unknown supplier -> flagged for data correction, no RiskCase
  - [ ] TC-09: duplicate event_id -> same correlation_id, no second case
  - [ ] Tenant mismatch between key and payload -> 403
  - [ ] pytest coverage for all of the above
- **Done in:** -
- **Notes:** -

### R-07: Boomi correlation + impact orchestration process
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 2d | **Depends:** R-04, R-05, N-02
- **Branch:** `roop/R-07-correlation`
- **Model hint:** sonnet / medium
- **Deliverables:** process `SG_Disruption_Correlate`: event -> fetch supplier/POs/inventory/alternates -> `POST /internal/risk-cases` (snapshot) -> invoke agents (N-06) -> post analysis back. Errors routed to error handling (R-10).
- **Acceptance:**
  - [ ] Demo scenario creates RiskCase with correct AffectedPOs in < 10 s
  - [ ] TC-03: all open POs of supplier evaluated
- **Done in:** -
- **Notes:** -

### R-08: Boomi API Management
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 1.5d | **Depends:** R-04, R-05
- **Branch:** `roop/R-08-api-management`
- **Model hint:** haiku / low (docs), sonnet / medium for policies
- **Deliverables:** API Proxy/Service in front of Boomi listener processes; API key policy; rate limit; Django `BoomiClient` uses gateway URL + key from env; `boomi/api/` contains the API definition (OpenAPI).
- **Acceptance:**
  - [ ] Calls without key are rejected by the gateway
  - [ ] Django -> gateway -> Boomi process works end to end
- **Done in:** -
- **Notes:** -

### R-09: Approved-action execution process
- **Status:** todo
- **Sprint:** S3 (8-14 Dec) | **Est:** 2.5d | **Depends:** R-04, N-08, N-09
- **Branch:** `roop/R-09-execution`
- **Model hint:** sonnet / medium; opus / high review (no write without approval)
- **Deliverables:** process `SG_Execute_Approved_Action`: verifies approval reference, PATCHes mock ERP with `Idempotency-Key = execution_id`, re-reads PO to verify, `POST /internal/executions/{id}/result`, publishes `recovery.status`.
- **Acceptance:**
  - [ ] TC-07: approved option updates the PO and case becomes RECOVERED only after verification
  - [ ] TC-06: rejected option never reaches ERP (asserted via mock ERP request log)
- **Done in:** -
- **Notes:** -

### R-10: Error handling, retry, dead-letter
- **Status:** todo
- **Sprint:** S3-S4 (12-17 Dec) | **Est:** 2d | **Depends:** R-06, R-09
- **Branch:** `roop/R-10-error-handling`
- **Model hint:** sonnet / medium; opus / high review
- **Deliverables:** error classification (validation / auth / business / transient / downstream) in Boomi + Django; bounded retry for transient only; failed message store (sanitized); `POST /executions/{id}/retry` with eligibility check.
- **Acceptance:**
  - [ ] TC-08: ERP timeout -> EXECUTION_FAILED, retry succeeds once, no duplicate PO update
  - [ ] Validation/auth errors are never auto-retried
  - [ ] No secrets in logs (grep check in test)
- **Done in:** -
- **Notes:** -

### R-11: Local + hosted deployment
- **Status:** todo
- **Sprint:** S1 tunnel (by 28 Nov), S4 hosted (15-20 Dec) | **Est:** 2d | **Depends:** U-01, R-02
- **Branch:** `roop/R-11-deploy`
- **Model hint:** sonnet / medium
- **Deliverables:** root `docker-compose.yml` (postgres, backend, frontend, mock-erp); tunnel instructions for Boomi cloud atom in S1; hosted backend/frontend/mock-erp + managed Postgres in S4; `deploy/` configs; secrets only in host env vars; `docs/INSTALL.md`.
- **Acceptance:**
  - [ ] `docker compose up` gives a working stack on a fresh clone
  - [ ] Hosted URLs reachable by Boomi; HTTPS
  - [ ] `.env.example` complete, no real secrets committed
- **Done in:** -
- **Notes:** -

### R-12: Marketplace accelerator package
- **Status:** todo
- **Sprint:** S5-S6 (24-30 Dec) | **Est:** 2d | **Depends:** R-09, N-08
- **Branch:** `roop/R-12-marketplace`
- **Model hint:** haiku / low for docs assembly, opus / high final review
- **Deliverables:** Boomi packaged components for all SG processes, agents, Flow, API; `boomi/marketplace/` with listing text, install guide, config templates, sample data, architecture diagram, screenshots.
- **Acceptance:**
  - [ ] Package installs into a clean Boomi account following only the guide (dry run by Uday or Nikhil)
- **Done in:** -
- **Notes:** -

### R-13: End-to-end integration tests
- **Status:** todo
- **Sprint:** S5 (21-26 Dec) | **Est:** 1.5d | **Depends:** R-09, R-10, N-09
- **Branch:** `roop/R-13-e2e-tests`
- **Model hint:** sonnet / medium to write, haiku / low to run and report
- **Deliverables:** `tests/e2e/` scripts that fire each scenario in `data/scenarios/` and assert outcomes; results table in `docs/TEST_REPORT.md`.
- **Acceptance:**
  - [ ] TC-01, 02, 03, 07, 08, 09 automated and passing
  - [ ] Event-to-risk latency measured and recorded (target < 10 s)
- **Done in:** -
- **Notes:** -
