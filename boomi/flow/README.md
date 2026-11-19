# boomi/flow - Boomi Flow approval app (R-06)

Owner: Roop. Status: **spec-first**. The Flow app is built in the Boomi platform once the environment (U-01) and the decision endpoint (N-10) exist. Everything needed to build it in minutes is in this folder.

## What it does and why
A Procurement Manager gets an approval task for a risk case: the evidence, the ranked recovery options, and three buttons - **Approve**, **Reject**, **Request changes** - plus a comment. Each click calls `POST /api/v1/recommendations/{id}/decision` in the SaaS backend. Approve is the only path that leads to an ERP write (BR-08: no ERP write without a recorded approval). If nobody decides within N hours the task escalates.

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
3. Create the Service/Connector `SupplyGuard API` pointing at the API Management gateway URL (see configuration); credential comes from API Management.
4. Create the swimlane limiting decisions to the role PROCUREMENT_MANAGER.
5. Save and publish; note the Flow ID and tenant ID. Store them in the team secret store (not in git).
6. The Boomi process that creates the approval task (U-10 / N-08 side) starts this Flow with `riskCaseId`, `recommendationId` and the correlation ID. Agree the start call with Uday (open question).
7. Run `test-plan.md`.

## Configuration values
Copy `values.example.json`; real values go in Boomi / the team secret store, never in git.

| Key | Meaning |
|---|---|
| `django_base_url` | SaaS API base, e.g. `https://<gateway-host>/api/v1` (through API Management, not direct Django) |
| `api_credential_name` | name of the API Management credential held in Boomi; value is never written down |
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
