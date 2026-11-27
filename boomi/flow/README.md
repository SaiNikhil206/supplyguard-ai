# boomi/flow - Boomi Flow approval app (R-06)

Owner: Roop. Status: **spec complete, Boomi-side build pending**. The decision endpoint (N-10) is built and this spec matches it exactly; the Flow app itself is built by hand in the Boomi platform once the environment (U-01) exists. Nothing in Boomi has been built or tested yet. Everything needed to build it in minutes is in this folder.

## What it does and why
A Procurement Manager gets an approval task for a risk case: the evidence, the ranked recovery options, and three buttons - **Approve**, **Reject**, **Request changes** - plus a comment. Each click calls `POST /api/v1/recommendations/{id}/decision` in the SaaS backend (one Recommendation per option; body `{decision, comments}`; success is a flat HTTP 201). Approve is the only path that leads to an ERP write (BR-08: no ERP write without a recorded approval). If nobody decides within N hours the task escalates.

Why Flow at all: it is Boomi's native human-in-the-loop piece, so the Boomi story (event -> agent -> human approval -> ERP write) is complete. The same decision can also be made in the SaaS Approval Center (R-05); both call the same endpoint, so the state machine (CONTRACTS section 7) stays the single source of truth.

## React-analogy primer
Flow = a low-code screen and form builder with a state diagram.

| Flow concept | React analogy |
|---|---|
| Flow app | the whole SPA |
| Page (page layout) | a component tree / screen |
| Components on a page (Table, Presentation, Textarea, Buttons) | JSX elements |
| Flow values (typed variables) | `useState` / global store; values bound to components are controlled inputs |
| Map elements (Start, Page, Decision, Message, Wait, Step) | routes plus the logic that picks the next route |
| Outcomes (button names on a page) | `onClick` handlers that navigate |
| Decision element | `if/else` in a handler |
| Connector / Service | an API client module (axios + typed functions) |
| Load / Save actions on a Service | `useQuery` fetch / `useMutation` POST |
| Wait element (timer) | `setTimeout` that survives closing the page |
| Swimlane / authorization | route guard (`<RequireRole>`) |

## Setup (once U-01 provisions the environment)
1. Confirm the Flow licence/tenant in the Boomi Platform (U-01 records it in `docs/BOOMI_ENV.md`). If missing, use the fallback below.
2. Create a Flow app `SupplyGuard Approval`. Build the map, pages and values exactly per `approval-flow-spec.md`.
3. Create the Service/Connector `SupplyGuard API` pointing at the API Management gateway URL (see configuration). Auth is the signed-in manager's JWT (`Authorization: Bearer`), NOT an API key: the endpoint returns 403 to API keys. See spec section 6.
4. Create the swimlane limiting decisions to the role PROCUREMENT_MANAGER.
5. Save and publish; note the Flow ID and tenant ID. Store them in the team secret store (not in git).
6. The Boomi process that creates the approval task (U-10 / N-08 side) starts this Flow with `riskCaseId`, `recommendationId` and the correlation ID. Agree the start call with Uday (open question).
7. Run `test-plan.md`.

## Configuration values
Copy `values.example.json`; real values go in Boomi / the team secret store, never in git.

| Key | Meaning |
|---|---|
| `django_base_url` | SaaS API base, e.g. `https://<gateway-host>/api/v1` (through API Management, not direct Django) |
| `auth_mode` | `user_jwt`: the manager's token from `POST /auth/token`; never an API key for the decision call |
| `escalation_hours` | N hours before an undecided approval escalates (default 24; ~2 minutes for the demo) |
| `escalation_contact_role` | role notified on escalation (ADMIN) |
| `required_role` | PROCUREMENT_MANAGER |
| `request_timeout_seconds`, `max_retries` | per-call timeout (15) and retry cap (3) |

## Fallback
If Flow is not licensed or not available: skip this app. Approvals happen only in the SaaS Approval Center (R-05); Django triggers the Boomi execution process after an approved decision (CONTRACTS section 8). No contract changes. Record the outcome in `boomi/TEST_LOG.md`.

## How to test
See `test-plan.md`: approve -> execution starts, reject -> no execution, decision visible in Approval Center and audit within 5 s, role check, error paths, escalation.

## Files
- `approval-flow-spec.md` - map, pages, values, service, errors, escalation, audit
- `test-plan.md` - acceptance tests mapped to CONTRACTS endpoints
- `values.example.json` - configuration placeholders

## Backend contract (verified against `backend/apps/workflow`)
- Request: `POST {base}/recommendations/{REC-id}/decision`, body `{"decision": "APPROVE|REJECT|REQUEST_CHANGES", "comments": "<=2000 chars>"}`; comments required for REJECT and REQUEST_CHANGES.
- Response 201 (flat): `approval_id, recommendation_id, decision, recommendation_status, risk_case_id, case_status, analysis_round, execution_id, decided_by, decided_at, correlation_id`.
- Auth: user JWT of role PROCUREMENT_MANAGER; tenant from the `tenant_id` claim; API key, ADMIN, OPS_MANAGER, VIEWER -> 403.
- Errors use the CONTRACTS s1 body: 400 validation, 401, 403, 404 (also other tenants' ids), 409 (`CASE_NOT_PENDING_APPROVAL`, `STALE_ROUND`, `ALREADY_DECIDED`, `ALREADY_APPROVED`), 422 `UNSUPPORTED_OPTION`.
- Reject of one option keeps the case `PENDING_APPROVAL` while other options remain; Request changes sends the case back to `ANALYZING` (round + 1).

## Manual Boomi steps still open (cannot be done from the repo)
1. Confirm Flow licence / tenant (U-01, `docs/BOOMI_ENV.md`).
2. Build the Flow app, service, pages, swimlane and escalation Wait per `approval-flow-spec.md`.
3. Agree with Uday: how the Boomi process starts the Flow, how the manager's JWT reaches Flow, API Management forwarding `Authorization`.
4. Run `test-plan.md` and record results in `boomi/TEST_LOG.md`.
