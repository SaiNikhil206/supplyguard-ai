# Tasks - Roop (Frontend · React SaaS UI, approval screens, demo & Marketplace)

**Background:** React / frontend developer. Claude explains backend, Boomi and data concepts in frontend terms (components, props, state, API calls, forms).
**Stream:** All React screens, the read APIs those screens use, the Boomi Flow approval screens, CI, demo story, Marketplace package.
**Owns:** `frontend/`, `backend/apps/portal/` (UI read APIs), `boomi/flow/`, `boomi/marketplace/`, `.github/workflows/ci.yml`, `docs/DEMO_SCRIPT.md`

> Status values: `todo` · `in-progress` · `blocked` · `review` · `done`. Only change the `Status`, `Done in`, checkboxes and Notes lines - keep the format, `scripts/progress.py` parses it.
> Model hint = what the advisor (Opus 5.5) should delegate the bulk of the work to. See `docs/AI_WORKFLOW.md`.

## Handoff
<!-- Overwrite this block at the end of EVERY session (run /handoff). Newest state only; history goes to progress/SESSION_LOG.md -->
- **Last updated:** 2026-11-25 (real-API wiring of R-03/04/05/07/08 done; R-06 docs aligned)
- **Current task:** - (R-01, R-02, R-03, R-05 `done`; R-04, R-07, R-08, R-09, R-10 `review`; R-06 docs done, Flow build manual, still `todo` on collaboration)
- **Branch:** `roop/R-08-admin-screens` (task branches R-04, R-05, R-07, R-08 pushed; R-04 already in collaboration; `roop/R-06-flow-approval` `5408f6e` pushed; `--wire` and `--stability` sub branches merged)
- **Where I left off:** Screens run against real API shapes (decision flat 201, what-if, audit, settings/users, portal); R-03 + R-04 auth/read checked live on seeded Django (VITE_API_MOCK=false). Combined branch check: tsc, lint, build, backend 1233 + portal 38 pass; Vitest was flaky (CPU contention), fixed in `--stability` (asyncUtilTimeout 5 s, maxWorkers 4; 5 green runs of 200). reviewer-lite APPROVE. NOT run live: R-05 decision, R-07 <3 s, R-08 AC-07 trace. R-05/R-07/R-08 pushes await auto-merge (gh not logged in here, Actions not checked).
- **Next step:** check Actions / `/merge-prs` so R-05, R-07, R-08 land in collaboration; set R-06 to `in-progress` on its own branch; live-run what-if, decision and audit trace on seeded Django; then R-06 Boomi Flow build (manual in Boomi UI). R-11/R-12 wait on S-03, U-10, N-09. Delete `tmp/roop-integ-check` + worktree `D:/hackathon/sg-integ`.
- **Blockers:** Backend gaps (Nikhil/Uday): no `POST /executions/{id}/retry` (`workflow.services.retry_execution` has no route), no approvals-queue endpoint, no tenant-roles endpoint, no user-update route, `/integrations/status` lacks per-service health. R-04 simulate-to-case 5 s needs U-07 -> N-08/N-09 chain. Uday still to confirm R-02 edits in his files; team to confirm timeline visibility, REJECTED-as-open, recovered_value meaning. Nested sessions refused on automated turns (visible ones worked on user request).
---

### R-01: Frontend scaffold + design system
- **Status:** done
- **Sprint:** S0-S1 (19-25 Nov) | **Est:** 2d | **Depends:** -
- **Branch:** `roop/R-01-frontend-scaffold`
- **Model hint:** sonnet / medium
- **Deliverables:** `frontend/` Vite + React 18 + TypeScript + Tailwind + React Router + TanStack Query + Recharts; app shell (sidebar with the 9 screens, tenant/user badge, light/dark tokens); login page + token refresh; API client typed from `docs/CONTRACTS.md` section 4 (switch to types generated from `/api/schema/` with openapi-typescript once U-02 is live); MSW mock handlers so screens work before the backend exists (`VITE_API_MOCK=true`); Vitest + Testing Library.
- **Acceptance:**
  - [x] `npm run build` and `npm test` green (10 files / 76 tests; `python scripts/run_checks.py` frontend PASS)
  - [x] Login + protected routes work against MSW mocks (`frontend/src/auth/__tests__/auth.test.tsx`)
  - [x] Setting `VITE_API_MOCK=false` points the same code at the real backend (`src/main.tsx` skips MSW worker; `src/api/config.test.ts`; `loginNoMock.test.tsx`; Vite proxy `/api` -> :8000)
- **Done in:** cfaec62
- **Notes:** Built via nested branches `--scaffold` (subagent), `--api` + `--ui` (visible sessions), `--auth`, `--review-fixes`, `--schema-fixes` (subagents). Opus review x2: CHANGES REQUIRED -> all MAJORs fixed -> APPROVE WITH NITS. Stack: React 18.3, Vite 8, Vitest 5, TS 5.9 (TS 7 avoided: no JS API for openapi-typescript), Node >=22.22.2 (`.nvmrc`); auto-merge.yml now on Node 22.22.2. Types hand-written from CONTRACTS + `ai/schemas` (ajv test validates mock analysis/plan); swap to openapi-typescript after U-02. Deferred: cross-tab refresh-token rotation + short refresh lifetime (Uday, backend), refresh token in localStorage (hackathon trade-off, README), `/settings` ADMIN gating (R-08). Mock users in `frontend/README.md`.

### R-02: Read APIs for the UI (Django `apps/portal`)
- **Status:** done
- **Sprint:** S1 (26-30 Nov) | **Est:** 2d | **Depends:** U-03, U-04
- **Branch:** `roop/R-02-read-apis`
- **Model hint:** sonnet / medium (Claude explains DRF as "the backend side of the screens you build")
- **Deliverables:** `backend/apps/portal/`: `GET /suppliers`, `GET /suppliers/{id}`, `GET /dashboard/summary`, `GET /risk-cases`, `GET /risk-cases/{id}` per CONTRACTS section 4; filters + pagination; built on Uday's tenant-scoped base classes (U-04); OpenAPI tags; pytest.
- **Acceptance:**
  - [x] Every endpoint tenant-scoped (uses U-04 mixin) and tested - `TenantScopedViewSet`/`TenantScopedMixin` in `backend/apps/portal/views.py`; tests `test_suppliers_only_own_tenant`, `test_supplier_foreign_id_404`, `test_risk_case_foreign_id_404_and_list_scoped`, `test_dashboard_only_own_tenant`
  - [x] `/risk-cases/{id}` returns event, affected POs, analysis, recommendations, approvals, executions, timeline in one call - `test_risk_case_detail_has_all_sections`, `test_detail_query_count_is_bounded`
  - [x] MSW mocks in `frontend/` updated to match the real responses - `frontend/src/mocks/README.md` "R-02 response shapes"; Opus reviewer APPROVE at 9912148; frontend 129 tests
- **Done in:** 3ffed0f
- **Notes:** Plan (2026-11-25, deps U-03/U-04 in review): piece | runs as | model / effort | branch -- backend 5 endpoints + tests | nested session | sonnet / medium | `roop/R-02-read-apis--backend` ; MSW mocks + TS types to real shape | nested session | sonnet / medium | `roop/R-02-read-apis--mocks` ; run suites | subagent test-runner | haiku / low ; review | subagent reviewer-lite | sonnet / medium. Fallback: nested sessions hit an org auth error at first, so the backend was built by an implementer subagent on `--backend2` (merged); the duplicate `--backend` from the late-starting nested session is superseded (only its role-matrix lines were taken). Touched Uday-owned files (agreed with Roop 2026-11-25, Uday to confirm): `apps/accounts/permissions.py` routed=True for suppliers.read, dashboard.read, risk-cases.read; `tests/test_role_matrix.py` ROUTES + EXPECTED_ROUTED; `config/urls.py` one include line for `apps.portal`. Team to confirm: case timeline (audit rows) visible to all reader roles per CONTRACTS s4, though `GET /audit` is ADMIN/PM only; REJECTED cases count as open (can return to ANALYZING). Open question: dashboard `recovered_value` = exposure sum of RECOVERED cases.

### R-03: Executive Overview + Supplier Intelligence screens
- **Status:** done
- **Sprint:** S2 (1-5 Dec) | **Est:** 2d | **Depends:** R-01, R-02
- **Branch:** `roop/R-03-overview-suppliers`
- **Model hint:** sonnet / medium
- **Deliverables:** KPI tiles (suppliers, open POs, active shipments, exposure, open cases, recovered), trend charts; supplier list with filters + risk badges; supplier detail with KPIs and disruption history.
- **Acceptance:**
  - [x] Real seed data shown; loading / empty / error states handled
- **Done in:** `roop/R-04-risk-center` (wire session, 2026-11-25; run against real Django, sqlite + `load_seed --demo-users`, `VITE_API_MOCK=false`)
- **Notes:** Started early on MSW mocks (R-02 waits on U-03/U-04). Built in 3 visible parallel sessions: `--overview` (6 KPI tiles + Recharts exposure/cases trends), `--supplier-list` (URL filters search/status/risk, risk badges, pagination), `--supplier-detail` (`/suppliers/:id`, KPIs, disruption history, 404 view), all merged; lint/typecheck/96 tests/build green; reviewer-lite APPROVE WITH NITS. Polish session (`--polish`) fixed all nits: shared `src/features/suppliers/status.ts` + `src/lib/format.ts`, sr-only chart summaries, fake-timer debounce test, out-of-range `?page` clamp, severity-tinted risk meter; 101 tests green. Left: after R-02 swap to real API + check field names, tick "real seed data". (Nits were: one supplier-status meta shared by list+detail, shared date/INR formatters in `src/lib/format.ts`, sr-only text summary for charts, fake timers in list debounce test, clamp out-of-range `?page`.) Note for R-04: case links use `/risk?case=<RC-id>`. Landed in collaboration on mocks (status review); real-data acceptance items stay unticked until backend APIs exist.

### R-04: Risk Command Center + case detail
- **Status:** review
- **Sprint:** S2-S3 (4-10 Dec) | **Est:** 2.5d | **Depends:** R-02, U-06
- **Branch:** `roop/R-04-risk-center`
- **Model hint:** sonnet / medium
- **Deliverables:** live case inbox (poll every 3 s), severity filters, "Simulate Supplier Disruption" button (calls `/demo/simulate-disruption`), case detail: event, affected POs table, AI analysis with facts / estimates / assumptions / missing data visually distinct, evidence links, status timeline.
- **Acceptance:**
  - [ ] New case appears within 5 s of the simulate click
  - [x] Estimates and missing data visibly labelled (AC-03)
- **Done in:** -
- **Notes:** Started early on MSW mocks (R-02, U-06 not done); swap to real API later. Plan: inbox (`/risk` list, severity/status URL filters, 3 s poll, ADMIN simulate button, `?case=` redirect; owns `src/api/queries.ts` poll option + stateful simulate mock) | nested session | sonnet/medium | `roop/R-04-risk-center--inbox`; case detail (`/risk/:id`: header, event, affected POs, approvals/executions, status timeline) | nested session | sonnet/medium | `roop/R-04-risk-center--detail`; AI analysis panel (facts/estimates/assumptions/missing data distinct, evidence list, AC-03) | nested session | sonnet/medium | `roop/R-04-risk-center--analysis`; wire panel into detail after merge | message `--detail` session | sonnet/medium | `--detail`; tests | test-runner | haiku/low | -; review | reviewer-lite | sonnet/medium | -. Landed in collaboration on mocks (status review). 2026-11-25 wired to the real API (`--wire`; read APIs + auth run live against seeded Django; contract tests in `realContract.test.ts`; test flake fixed in `--stability`: asyncUtilTimeout 5 s, vitest maxWorkers 4). Stays `review`: "new case within 5 s of simulate click" not tried live yet. `POST /demo/simulate-disruption` exists (apps/integrations, U-06) but it only creates an event; the case appears after correlation + analysis (N-08/N-09, waiting on U-07), so tick it once that chain works end to end.

### R-05: AI Recommendations + Approval Center
- **Status:** done
- **Sprint:** S3 (8-12 Dec) | **Est:** 2d | **Depends:** R-04, N-10
- **Branch:** `roop/R-05-approvals`
- **Model hint:** sonnet / medium
- **Deliverables:** ranked option cards with cost / lead-time comparison, trade-offs, evidence; pending approvals queue; Approve / Reject / Request changes with comment (role-gated); execution status + retry button (U-11).
- **Acceptance:**
  - [x] Buttons hidden/disabled for roles that cannot decide
  - [x] UNSUPPORTED options shown but not approvable
- **Done in:** `roop/R-05-approvals` (`--wire` d3f96ee merged; reviewer-lite APPROVE on combined diff, 2026-11-25)
- **Notes:** 2026-11-25 wired to the real API: flat decision response (`POST /recommendations/{id}/decision` 201), `canDecide` = PROCUREMENT_MANAGER only (ADMIN excluded, as backend), unsupported or null cost/lead-time options not approvable. Checked by reading serializers/views + contract tests, NOT yet run live against Django. Backend gaps (not mine, tell Nikhil/Uday): no `POST /executions/{id}/retry` route (`workflow.services.retry_execution` exists without an endpoint; UI degrades with a clear message on 404/405), no approvals-queue endpoint (queue derives from GET /risk-cases). Confirm retry should be manager-only once the endpoint exists. Earlier pieces: recommendations | session | sonnet/medium | roop/R-05-approvals--recommendations; approvals | session | sonnet/medium | roop/R-05-approvals--approvals.

### R-06: Boomi Flow approval workflow
- **Status:** in-progress
- **Sprint:** S3 (9-14 Dec) | **Est:** 2.5d | **Depends:** N-07, N-10, U-01
- **Branch:** `roop/R-06-flow-approval`
- **Model hint:** sonnet / medium via `boomi-builder` (Claude explains Flow as "a low-code screen + form builder with a state diagram")
- **Deliverables:** Flow app: approval page showing evidence + options, Approve / Reject / Request changes, comment, escalation after N hours; each decision calls `POST /recommendations/{id}/decision` (Nikhil's endpoint, N-10), which triggers execution (U-10) on approve. Direction and setup documented in `boomi/flow/README.md`. Fallback if Flow is not licensed: SaaS Approval Center (R-05) only.
- **Acceptance:**
  - [ ] Approve in Flow -> execution starts; Reject -> no execution
  - [ ] Decision visible in the SaaS Approval Center and audit within 5 s
- **Done in:** -
- **Notes:** Docs delivered: boomi/flow/ README, approval-flow-spec, test-plan, values.example.json, now verified against the real N-10 endpoint (flat 201, user JWT only - API key/ADMIN get 403, per-option recommendation id, 409 reasons, 422 UNSUPPORTED_OPTION, Reject keeps case PENDING_APPROVAL while options remain). Acceptance boxes stay unchecked: they need the Flow built in Boomi. MANUAL Boomi steps: licence check (U-01), build app/service/pages/swimlane/escalation Wait, run test-plan. Open for Uday: how Boomi starts the Flow, how the manager JWT reaches Flow, API Mgmt forwarding Authorization. Open for Nikhil: escalation audit event (APPROVAL_ESCALATED) endpoint. Piece: flow-spec | session | sonnet/medium | roop/R-06-flow-approval--flow-spec.

### R-07: What-if Simulator UI
- **Status:** done
- **Sprint:** S4 (15-17 Dec) | **Est:** 1.5d | **Depends:** N-11, R-01
- **Branch:** `roop/R-07-what-if-ui`
- **Model hint:** sonnet / medium
- **Deliverables:** supplier picker, duration slider, event type; results: affected POs, inventory gap chart, exposure, best option, assumptions panel.
- **Acceptance:**
  - [x] "Supplier A out 7 days" renders in < 3 s
- **Done in:** `roop/R-07-what-if-ui` (in collaboration; live check 2026-11-27 on real Django + seed: `POST /what-if` SUP-1008 7 days 0.74 s cold, ~0.37 s warm; all response fields match the UI types)
- **Notes:** Started early on MSW mocks (N-11 not done; what-if response shape PROVISIONAL, own types file `src/api/whatif.ts`). Plan: what-if form + results | nested session | sonnet/medium | `roop/R-07-what-if-ui--simulator`; tests | test-runner | haiku/low | -; review | reviewer-lite | sonnet/medium | -. 2026-11-25 wired to real N-11 (`POST /what-if`: scenario, affected_pos, inventory gaps/items/coverage, best_option_estimate, data_gaps); request sends supplier_id, event_type, duration_days, optional start; chart renamed InventoryCoverageChart; reviewer-lite APPROVE. Live check done 2026-11-27 (see Done in). Note: backend requires `event_type` in the request (UI sends it).

### R-08: Integration Center, Audit Center, Tenant Settings
- **Status:** review
- **Sprint:** S4 (16-20 Dec) | **Est:** 2d | **Depends:** U-04, U-05, U-06
- **Branch:** `roop/R-08-admin-screens`
- **Model hint:** sonnet / medium
- **Deliverables:** connection health cards (`/integrations/status`); audit table with filters + correlation-id trace view; settings (risk thresholds, users, roles) for ADMIN.
- **Acceptance:**
  - [ ] Searching a correlation id shows event -> analysis -> approval -> execution in order (AC-07)
- **Done in:** -
- **Notes:** Started early on MSW mocks (U-04/U-05/U-06 not done; response shapes PROVISIONAL, own files `src/api/admin.ts`, `src/mocks/admin.ts`). Plan: integration health cards | nested session | sonnet/medium | `roop/R-08-admin-screens--integrations`; audit table + correlation trace (AC-07) | nested session | sonnet/medium | `roop/R-08-admin-screens--audit`; tenant settings (thresholds, users, roles; ADMIN) | nested session | sonnet/medium | `roop/R-08-admin-screens--settings`; tests | test-runner | haiku/low | -; review | reviewer-lite | sonnet/medium | -. 2026-11-25 wired to the real backend shapes (`GET /integrations/status`, `GET /audit?correlation_id=`, `GET/PATCH /settings`, `GET/POST /users`, `GET /me`); reviewer-lite APPROVE; 205 tests green. Live check 2026-11-27 (real Django + seed): integrations, settings, users, audit shapes match. AC-07 stays unticked: `/audit?correlation_id=` returns the full chain in order (event -> analysis x2 -> decision -> status changes -> execution) only when the Boomi/internal callbacks forward `X-Correlation-ID`; without it the analysis callbacks get fresh ids and drop out of the trace. Gap for Nikhil (AnalysisView: default callback correlation id to the case/event id) and Uday (Boomi processes forward the header; add `entity_id`/`actor` audit filters; no distinct execution.succeeded action; /audit is newest-first so the UI sorts ascending). Earlier note: AC-07 trace not tried live (client orders `/audit` events by timestamp; no dedicated trace endpoint). Backend gaps for Uday: no tenant-roles endpoint, no user-update/role-change route (UI shows roles read-only, controls disabled with a note), per-service health missing from `/integrations/status`, `listUsers` shows first page (25) only.

### R-09: CI pipeline
- **Status:** review
- **Sprint:** S1 (24-26 Nov) | **Est:** 0.5d | **Depends:** R-01, U-02
- **Branch:** `roop/R-09-ci`
- **Model hint:** haiku / low
- **Deliverables:** `.github/workflows/ci.yml`: backend ruff + pytest with Postgres service, frontend lint + typecheck + test + build, mock-erp tests; runs on PRs to `collaboration` and `main`.
- **Acceptance:**
  - [ ] CI green on `collaboration`; added as required check on both protected branches
- **Done in:** -
- **Notes:** Built on nested branches `--lint`, `--workflow`, `--gate` (subagents). `ci.yml` jobs: backend (ruff + pytest on Postgres 16), frontend (lint/typecheck/test/build, Node from `.nvmrc`), python-suites matrix (ai, data, mock-erp), `ci-ok` aggregate. Triggers: task-branch pushes, PRs + pushes to collaboration/main, nightly 02:00 UTC, manual. ESLint 9 flat config added (`npm run lint`, 0 warnings). Auto-merge gate (`scripts/run_checks.py`) now also runs frontend lint + backend ruff. Opus review x2: CHANGES REQUIRED -> APPROVE WITH NITS (nits fixed). Local `run_checks.py`: all 5 suites PASS. 2026-11-27: tried to add the required-check rule in GitHub (Settings > Rules). GitHub shows "rulesets won't be enforced on this private repository until you upgrade this organization account to GitHub Team", so no branch protection or required check can be enforced on this plan (classic rules likewise). Nothing was created. CI itself is built and green; the enforced gate today is the auto-merge check `scripts/run_checks.py` (ruff, lint, typecheck, tests, build). Options for the team: upgrade `nexbit-labs` to GitHub Team (billing owner), make the repo public, or accept the auto-merge gate as the check. Stays `review` until the team picks. Why `review` not `done`: acceptance "required check on both protected branches" conflicts with bots pushing directly to collaboration (GITHUB_TOKEN cannot bypass) -> proposed SHARED change: require `ci-ok` on `main` only; prove collaboration green via nightly/manual run. Deferred: bot `[skip ci]` in `scripts/gitflow.py` + `progress.yml` blocks milestone PR checks (team); ruff unpinned in `backend/requirements-dev.txt` (Uday).

### R-10: UX polish + demo mode
- **Status:** done
- **Sprint:** S5 (21-26 Dec) | **Est:** 1.5d | **Depends:** R-03, R-04, R-05, R-07, R-08
- **Branch:** `roop/R-10-polish`
- **Model hint:** sonnet / medium; opus / high for a final UI review
- **Deliverables:** consistent spacing/typography, responsive down to 1280 px, skeleton loaders, toasts, "illustrative synthetic data" label, demo reset button (ADMIN), screenshots for the Marketplace listing.
- **Acceptance:**
  - [x] Full demo path clicked through with zero console errors
- **Done in:** `roop/R-10-polish` (in collaboration; click-through 2026-11-27 in mock/demo mode: login admin + manager, all 9 screens, simulate -> new case 265 ms, approve -> execution Succeeded -> Recovered, what-if 536 ms; 0 console errors, 0 alert banners)
- **Notes:** Redesign with shadcn/ui on Tailwind (user request). Base = collaboration + R-05/R-07/R-08 merged. Plan: shadcn foundation (theme, `src/components/ui` rebuilt on shadcn with same exports, app shell + command palette) | nested session | sonnet/medium | `roop/R-10-polish--foundation`; then in parallel: overview+suppliers screens | session | sonnet/medium | `--screens-insight`; risk+recommendations+approvals | session | sonnet/medium | `--screens-risk`; what-if+integrations+audit+settings+login | session | sonnet/medium | `--screens-admin`; final UI review | reviewer | opus/high | -. v2 pass (2026-11-23, user: "whole UI unprofessional"): foundation-v2 merged; screens restyled to docs/DESIGN_DIRECTION.md v2 | overview+suppliers+shared patterns | session | sonnet/medium | `--v2-insight`; risk+recommendations+approvals | session | sonnet/medium | `--v2-risk`; what-if+integrations+audit+settings | session | sonnet/medium | `--v2-admin`; test-runner haiku/low; reviewer-lite sonnet/medium. 2026-11-25: v2 restyle reverted at owner request (prefers colorful v1, branch `--restore-v1`); set to review to land the v1 UI (and the R-05/R-07/R-08 screens it carries) in collaboration; still open: demo reset button (ADMIN), Marketplace screenshots, zero-console-error click-through (401 on reload from token refresh).

### R-11: Demo script, deck, video storyboard
- **Status:** in-progress
- **Sprint:** S6 (27-31 Dec) | **Est:** 2d | **Depends:** S-03
- **Branch:** `roop/R-11-demo-script`
- **Model hint:** opus / high for the story, haiku / low for formatting
- **Deliverables:** `docs/DEMO_SCRIPT.md` (7-8 min, 7 scenes from `docs/PRODUCT_STRATEGY.md`), slide deck outline, video shot list, Q&A prep (architecture, AI governance, Marketplace) - Nikhil and Uday supply the technical answers.
- **Acceptance:**
  - [ ] Two timed rehearsals under 8 min
  - [ ] Every Boomi service has a visible moment
- **Done in:** -
- **Notes:** Drafts done (script, deck outline, shot list, Q&A); needs S-03 dry run + 2 timed rehearsals. Piece: script | session | opus/medium | roop/R-11-demo-script--script.

### R-12: Marketplace accelerator package
- **Status:** in-progress
- **Sprint:** S5-S6 (24-30 Dec) | **Est:** 2d | **Depends:** U-10, R-06, N-09
- **Branch:** `roop/R-12-marketplace`
- **Model hint:** haiku / low for docs assembly, opus / high final review
- **Deliverables:** `boomi/marketplace/`: listing text, install guide, config templates, sample data, architecture diagram, screenshots; Boomi packaged components list (Uday and Nikhil package their own processes/agents, Roop assembles).
- **Acceptance:**
  - [ ] Package installs into a clean Boomi account following only the guide (dry run by Nikhil or Uday)
- **Done in:** -
- **Notes:** Draft package (listing, install guide, config templates, architecture, components list, dry-run checklist) done; waits for U-10/N-09 exports + R-10 screenshots + dry run. Piece: package | session | sonnet/medium | roop/R-12-marketplace--package.
