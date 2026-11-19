# Tasks - Uday (SaaS Product: Backend Core + Frontend)

**Stream:** Django project + core models, auth, tenant isolation, RBAC, read APIs, audit, React SaaS UI (all screens), CI.
**Owns:** `backend/` project + `apps/tenants`, `apps/accounts`, `apps/core`, `apps/audit`; `frontend/`; `.github/workflows/ci.yml`

> Status values: `todo` · `in-progress` · `blocked` · `review` · `done`. Only change the `Status`, `Done in`, checkboxes and Notes lines - keep the format, `scripts/progress.py` parses it.
> Model hint = what the advisor (Opus 5.5) should delegate the bulk of the work to. See `docs/AI_WORKFLOW.md`.

## Handoff
<!-- Overwrite this block at the end of EVERY session (run /handoff). Newest state only; history goes to progress/SESSION_LOG.md -->
- **Last updated:** 2026-11-19 (setup)
- **Current task:** -
- **Branch:** -
- **Where I left off:** Project structure and task split created. Nothing implemented yet.
- **Next step:** Start U-01 (backend scaffold) today - Roop and Nikhil depend on U-02 models by 23 Nov.
- **Blockers:** none

---

### U-01: Backend scaffold
- **Status:** todo
- **Sprint:** S0 (19-21 Nov) | **Est:** 1d | **Depends:** -
- **Branch:** `uday/U-01-backend-scaffold`
- **Model hint:** sonnet / medium
- **Deliverables:** `backend/` Django 5 + DRF + drf-spectacular + simplejwt + psycopg; settings from env (`django-environ`), apps folder layout `backend/apps/{tenants,accounts,core,audit,integrations,intelligence,workflow}` (empty shells for Roop/Nikhil), `/api/health`, pytest + pytest-django, ruff config, Dockerfile, Postgres in root `docker-compose.yml`.
- **Acceptance:**
  - [ ] `docker compose up backend db` serves `/api/health` and `/api/schema/`
  - [ ] `pytest` runs green with one smoke test
  - [ ] Empty app shells exist so other streams can start without touching settings
- **Done in:** -
- **Notes:** -

### U-02: Core data model + seed loader
- **Status:** todo
- **Sprint:** S0 (20-23 Nov) | **Est:** 2d | **Depends:** U-01, S-01
- **Branch:** `uday/U-02-core-models`
- **Model hint:** opus / high for model design review, sonnet / medium implement
- **Deliverables:** models for all 12 LLD entities (Tenant, User, Supplier, PurchaseOrder (+lines), Inventory, DisruptionEvent, RiskCase, AffectedPO, Recommendation, Approval, Execution, AuditEvent) with `tenant` FK on every tenant-owned table, RiskCase states from CONTRACTS section 7, indexes on (tenant, status) etc.; `manage.py load_seed` reading `data/seed/`.
- **Acceptance:**
  - [ ] Migrations apply on empty Postgres
  - [ ] `load_seed` loads both tenants and is idempotent
  - [ ] Admin registered for all models
  - [ ] Field names match CONTRACTS / LLD 16.1
- **Done in:** -
- **Notes:** Highest-priority task in the team - unblocks R-06, N-02, N-05, N-09.

### U-03: Auth, tenant isolation, RBAC
- **Status:** todo
- **Sprint:** S1 (24-27 Nov) | **Est:** 2d | **Depends:** U-02
- **Branch:** `uday/U-03-auth-tenancy`
- **Model hint:** opus / high (security-critical)
- **Deliverables:** JWT with `tenant_id` + `role` claims; `TenantScopedViewSet` mixin / manager that filters every queryset by `request.tenant`; role permission classes per CONTRACTS section 2; API-key auth class for `SYSTEM` callers (used by Roop); denied cross-tenant attempts logged.
- **Acceptance:**
  - [ ] TC-10: user of TEN-ACME requesting TEN-GLOBEX case -> 404/403 and audit row
  - [ ] tenant_id in body/query is ignored (test)
  - [ ] Permission matrix test for all 5 roles
- **Done in:** -
- **Notes:** -

### U-04: Read APIs (suppliers, dashboard, risk cases)
- **Status:** todo
- **Sprint:** S1 (26-30 Nov) | **Est:** 2d | **Depends:** U-03
- **Branch:** `uday/U-04-read-apis`
- **Model hint:** sonnet / medium
- **Deliverables:** endpoints owned by Uday in CONTRACTS section 4 (suppliers, supplier detail, dashboard summary, risk-cases list/detail with nested timeline, settings, users); filters + pagination; OpenAPI tags.
- **Acceptance:**
  - [ ] Every endpoint tenant-scoped and tested
  - [ ] `/risk-cases/{id}` returns event, affected POs, analysis, recommendations, approvals, executions, timeline in one call
- **Done in:** -
- **Notes:** -

### U-05: Audit service + correlation-id middleware
- **Status:** todo
- **Sprint:** S1 (24-27 Nov) | **Est:** 1d | **Depends:** U-02
- **Branch:** `uday/U-05-audit`
- **Model hint:** sonnet / medium
- **Deliverables:** `apps.audit.record(actor, action, entity, correlation_id, data)` used by all apps; middleware that reads/creates `X-Correlation-ID` and adds it to responses + logs; `GET /audit` with filters.
- **Acceptance:**
  - [ ] Correlation id visible in response headers and in audit rows
  - [ ] Audit rows are append-only (no update/delete API)
- **Done in:** -
- **Notes:** -

### U-06: Frontend scaffold + design system
- **Status:** todo
- **Sprint:** S1 (24-30 Nov) | **Est:** 2d | **Depends:** U-01
- **Branch:** `uday/U-06-frontend-scaffold`
- **Model hint:** sonnet / medium
- **Deliverables:** `frontend/` Vite + React 18 + TypeScript + Tailwind + React Router + TanStack Query + Recharts; login page + token refresh; app shell (sidebar with 8 screens, tenant/user badge); typed API client generated from `/api/schema/` (openapi-typescript); Vitest + Testing Library; light/dark tokens.
- **Acceptance:**
  - [ ] Login works against backend, protected routes redirect
  - [ ] `npm run build` and `npm test` green
- **Done in:** -
- **Notes:** -

### U-07: Executive Overview + Supplier Intelligence screens
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 2d | **Depends:** U-04, U-06
- **Branch:** `uday/U-07-overview-suppliers`
- **Model hint:** sonnet / medium
- **Deliverables:** KPI tiles (suppliers, open POs, active shipments, exposure, open cases, recovered), trend charts; supplier list with filters + risk badges; supplier detail with KPIs and disruption history.
- **Acceptance:**
  - [ ] Real seed data shown, loading/empty/error states handled
- **Done in:** -
- **Notes:** -

### U-08: Risk Command Center + case detail
- **Status:** todo
- **Sprint:** S2-S3 (4-10 Dec) | **Est:** 2.5d | **Depends:** U-04, R-06
- **Branch:** `uday/U-08-risk-center`
- **Model hint:** sonnet / medium
- **Deliverables:** live case inbox (poll every 3 s or SSE), severity filters, "Simulate Supplier Disruption" button (calls `/demo/simulate-disruption`), case detail: event, affected POs table, AI analysis with facts / estimates / assumptions / missing data visually distinct, evidence links, status timeline.
- **Acceptance:**
  - [ ] New case appears within 5 s of simulate click
  - [ ] Estimates and missing data visibly labelled (AC-03)
- **Done in:** -
- **Notes:** -

### U-09: AI Recommendations + Approval Center
- **Status:** todo
- **Sprint:** S3 (8-14 Dec) | **Est:** 2d | **Depends:** U-08, N-09
- **Branch:** `uday/U-09-approvals`
- **Model hint:** sonnet / medium
- **Deliverables:** ranked option cards with cost/lead-time comparison, trade-offs, evidence; pending approvals queue; Approve / Reject / Request changes with comment (role-gated); execution status + retry button (R-10).
- **Acceptance:**
  - [ ] Buttons hidden/disabled for roles that cannot decide
  - [ ] UNSUPPORTED options shown but not approvable
- **Done in:** -
- **Notes:** -

### U-10: What-if Simulator UI
- **Status:** todo
- **Sprint:** S4 (15-18 Dec) | **Est:** 1.5d | **Depends:** N-07, U-06
- **Branch:** `uday/U-10-what-if-ui`
- **Model hint:** sonnet / medium
- **Deliverables:** supplier picker, duration slider, event type; results: affected POs, inventory gap chart, exposure, best option, assumptions panel.
- **Acceptance:**
  - [ ] "Supplier A out 7 days" scenario renders in < 3 s
- **Done in:** -
- **Notes:** -

### U-11: Integration Center, Audit Center, Tenant Settings
- **Status:** todo
- **Sprint:** S4 (15-20 Dec) | **Est:** 2d | **Depends:** U-04, U-05, R-06
- **Branch:** `uday/U-11-admin-screens`
- **Model hint:** sonnet / medium
- **Deliverables:** connection health cards (`/integrations/status`); audit table with filters + correlation-id trace view; settings (risk thresholds, users, roles) for ADMIN.
- **Acceptance:**
  - [ ] Searching a correlation id shows event -> analysis -> approval -> execution in order (AC-07)
- **Done in:** -
- **Notes:** -

### U-12: CI pipeline
- **Status:** todo
- **Sprint:** S1 (24-26 Nov) | **Est:** 0.5d | **Depends:** U-01, U-06
- **Branch:** `uday/U-12-ci`
- **Model hint:** haiku / low
- **Deliverables:** `.github/workflows/ci.yml`: backend ruff + pytest with Postgres service, frontend lint + typecheck + test + build, mock-erp tests; runs on PRs to `collaboration` and `main`.
- **Acceptance:**
  - [ ] CI green on `collaboration`; required check on PRs
- **Done in:** -
- **Notes:** -

### U-13: UX polish + demo mode
- **Status:** todo
- **Sprint:** S5 (21-26 Dec) | **Est:** 1.5d | **Depends:** U-07..U-11
- **Branch:** `uday/U-13-polish`
- **Model hint:** sonnet / medium; opus / high for a final UI review
- **Deliverables:** consistent spacing/typography, responsive down to 1280 px, skeleton loaders, toasts, "illustrative synthetic data" label, demo reset button (ADMIN), screenshots for Marketplace listing.
- **Acceptance:**
  - [ ] Full demo path clicked through with zero console errors
- **Done in:** -
- **Notes:** -
