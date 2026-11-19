# SupplyGuard AI - Live Demo Script (DRAFT v0.1)

Owner: Roop (task R-11). Status: **draft to rehearse** - S-03 dry run has not happened yet. Every number on screen is **illustrative synthetic data** and must be labelled so (PRODUCT_STRATEGY). Any number we quote about performance is a placeholder `[measured: ...]` until a rehearsal measures it.

Related: `docs/demo/DECK_OUTLINE.md`, `docs/demo/VIDEO_SHOT_LIST.md`, `docs/demo/QA_PREP.md`.

## Roles on stage
| Who | Does |
|---|---|
| Presenter (Roop) | Narration, drives the SaaS browser window |
| Operator 1 (Uday) | Drives Boomi consoles: Event Streams, Process Reporting, API Management, (Data Hub) |
| Operator 2 (Nikhil) | Drives Agentstudio + Flow; watches mock-ERP logs; calls the fallback if a service fails |

Single-presenter variant: one person drives everything from pre-opened tabs (see tab order below).

## Timing overview (target 7:50, hard limit 8:00)
| # | Scene | Budget | Running total |
|---|---|---|---|
| 0 | Opening hook | 0:20 | 0:20 |
| 1 | Normal operations | 0:50 | 1:10 |
| 2 | Simulate supplier disruption | 1:05 | 2:15 |
| 3 | Supplier Risk Analyst | 1:20 | 3:35 |
| 4 | Recovery Planning Agent | 1:10 | 4:45 |
| 5 | Approval in Flow | 1:00 | 5:45 |
| 6 | Boomi updates the ERP, verified | 0:55 | 6:40 |
| 7 | Back to the dashboard - audited | 0:50 | 7:30 |
| 8 | Closing line | 0:20 | 7:50 |

Buffer: 0:10. If a rehearsal runs long, cut in this order: (a) What-if aside in scene 4, (b) API Management analytics in scene 6, (c) Data Hub moment in scene 1.

---

## Setup (T-60 min)
1. Pull `collaboration`, confirm the build is the tagged demo build `[tag: m6 or v1.0]`.
2. Start the stack: `docker compose up -d` (Django, PostgreSQL, mock ERP, frontend). Frontend with real API: `VITE_API_MOCK=false`.
3. Confirm Boomi: Atom online, processes deployed, Event Streams topics `supplier.disruption`, `shipment.delay`, `recovery.status` exist, both Agentstudio agents deployed, Flow app published, API Management gateway up. (Uday/Nikhil check; see `docs/BOOMI_ENV.md`.)
4. Open `/integrations` - every connection green. If any is red, decide **now** which section-8 fallback is used and tell the presenter.
5. Mock ERP chaos off: `POST /erp/_chaos {"mode":"off"}`.
6. Browser: zoom 125 %, light theme, notifications off, bookmarks bar hidden, second screen mirrored.

### Demo users (password `demo123` for all; mock users from `frontend/README.md`)
| Username | Role | Used in |
|---|---|---|
| `admin` | ADMIN | Scenes 1-4, 6-7 (simulate disruption needs ADMIN) |
| `manager` | PROCUREMENT_MANAGER | Scene 5 (approve) - log in in a **second browser profile** beforehand |
| `viewer` | VIEWER | Q&A only: show read-only / RBAC if asked |

Tenant: `TEN-ACME`. Hero case in mock data: `RC-000045`, factory outage at `SUP-1008`. In the live run the new case ID is whatever is created; the presenter reads it from the screen.

### Tab order (pre-opened, left to right)
1. SaaS `/` as `admin` 2. SaaS `/approvals` as `manager` (second profile) 3. Boomi Event Streams - topic `supplier.disruption` 4. Boomi Agentstudio - Supplier Risk Analyst run history 5. Boomi Flow - running app 6. Boomi Process Reporting 7. Boomi API Management - API dashboard 8. Mock ERP `GET /erp/purchase-orders/PO-1001` (JSON viewer) 9. (Data Hub - SUP-1008 golden record, only if licensed)

### Reset (between rehearsals and right before going on stage)
1. `python manage.py demo_reset --tenant TEN-ACME` `[command name to confirm - OWNER: Uday]` - reloads seed: 100 suppliers, 500 POs, 20 active shipments, deletes demo risk cases.
2. Mock ERP: reload seed `[command - OWNER: Nikhil]`, chaos `off`.
3. Clear Event Streams backlog / confirm no un-acked messages on `supplier.disruption`.
4. Hard-refresh every SaaS tab; log `admin` and `manager` back in (tokens live 15 min - log in no earlier than 10 min before start).
5. Start the stopwatch on the first spoken word.

---

## Scene 0 - Opening hook (0:20, total 0:20)
**Screen:** SaaS `/` (Executive Overview), not yet narrated.
**Narration:**
> "A supplier's factory catches fire at 10 a.m. Most companies find out days later, when a purchase order is already late. In the next seven minutes we'll detect it, understand it, fix it, and prove what we did - with Boomi doing the heavy lifting."

## Scene 1 - Normal operations (0:50, total 1:10)
**Clicks:**
1. `/` - point at KPI tiles: suppliers, open POs, active shipments, open risk cases (0). Label "Synthetic demo data" visible in the header.
2. `/suppliers` - scroll the list, search `SUP-1008`, open the supplier detail: KPIs, on-time rate, disruption history.
3. (Optional, only if Data Hub is licensed) Data Hub tab: SUP-1008 golden record merged from two source records.

**Narration:**
> "This is Acme's normal day: 100 suppliers, 500 open purchase orders, 20 shipments in transit - synthetic data. All of it is pulled from the ERP by Boomi Integration and mapped to one canonical model. SUP-1008 is a key supplier - remember this name."
> (Data Hub) "Boomi Data Hub keeps one golden record per supplier, so duplicates from two ERPs don't split the risk picture."

**Boomi shown:** Integration (implicitly - data source; explicit moment in scene 6). Data Hub (optional, explicit tab).
**Fallback:** SaaS down -> play the pre-recorded video from shot 2 (`docs/demo/VIDEO_SHOT_LIST.md`). Data Hub unavailable -> skip the line (CONTRACTS section 8: skip).

## Scene 2 - Simulate supplier disruption (1:05, total 2:15)
**Clicks:**
1. `/` -> button **Simulate Supplier Disruption** (ADMIN) -> scenario "Factory outage - SUP-1008 - 48 h" -> **Send**. (Calls `POST /api/v1/demo/simulate-disruption`.)
2. Toast shows `event_id` + `correlation_id`. Read the correlation ID's first 4 characters aloud.
3. Switch to Boomi **Event Streams** tab: topic `supplier.disruption` - new message, open payload (event_type FACTORY_OUTAGE, severity HIGH, expected_duration_hours 48, same correlation_id).
4. Switch to Boomi **Process Reporting**: the intake/correlation process run that pulls ERP POs and inventory for SUP-1008.
5. Back to SaaS `/risk` (Risk Command Center): new case appears with status `RECEIVED` -> `ANALYZING`.

**Narration:**
> "Line 2 at SUP-1008 is on fire; production halted for 48 hours. The supplier portal raises an event. It lands on Boomi Event Streams, on the supplier.disruption topic - here is the exact payload, with a correlation ID we'll follow all the way to the ERP. Boomi Integration picks it up, pulls the open POs and stock for this supplier, and hands a snapshot to SupplyGuard. A risk case is open - under a minute after the event."

**Boomi shown:** Event Streams (topic + payload), Integration (process execution in Process Reporting), API Management (the event enters through the governed API - mention only; shown in scene 6).
**Fallback:** Event Streams down -> event enters via API Management endpoint that triggers the Boomi process directly (CONTRACTS 8). Narrate: "In this run the event comes straight through the API gateway" and show Process Reporting instead of the topic. Simulate button fails -> Operator 1 posts the canonical event JSON from the saved Postman request `[collection path - OWNER: Uday]`.

## Scene 3 - Supplier Risk Analyst (1:20, total 3:35)
**Clicks:**
1. `/risk` -> click the new case -> `/risk/:id` (Risk case detail). Status now `RECOMMENDATION_READY`.
2. Analysis panel: risk level + score, summary, **affected POs** table (PO-1001 ...), each with due date and value.
3. Point at evidence tags: FACT / ESTIMATE / ASSUMPTION / MISSING_DATA. Hover one FACT -> source `ERP`, entity `PO-1001`, field `expected_date`.
4. Point at "Missing data" line (e.g. "supplier capacity not provided").
5. Switch to Boomi **Agentstudio** tab: Supplier Risk Analyst - this run, tools called (ERP lookup), structured JSON output.

**Narration:**
> "Boomi Agentstudio runs our Supplier Risk Analyst. It reads the supplier's history and the ERP snapshot, and finds which purchase orders are actually hit. Notice it's not chat text: every statement is tagged. Facts link to an ERP record - this one is PO-1001's expected date. Estimates show their basis. And when data is missing, the agent says so instead of guessing. Before anything is stored, a validator checks every ID, quantity and price against the ERP snapshot - if the AI invents a PO, it's rejected."

**Boomi shown:** Agentstudio (agent run + tool calls + output).
**Fallback:** Agentstudio unavailable -> Django `apps.intelligence.agents` calls Claude API with the same JSON schemas (CONTRACTS 8). The screen is identical; narrate honestly: "Today the same agent contract runs on our backup model path" - do **not** show the Agentstudio tab. Analysis slow (> `[measured: p95 analysis time]`) -> open hero case `RC-000045` from seed data and say "here's one prepared earlier".

## Scene 4 - Recovery Planning Agent (1:10, total 4:45)
**Clicks:**
1. `/recommendations` (or Recommendations tab on `/risk/:id`): ranked options - e.g. #1 ALTERNATE_SUPPLIER (SUP-2001), #2 INVENTORY_TRANSFER, #3 REVISED_SCHEDULE.
2. Expand option #1: proposed action (PO-1001 -> SUP-2001, qty), estimated lead time, estimated cost delta, trade-offs, evidence, assumptions.
3. Click **Submit for approval** -> status `PENDING_APPROVAL`.
4. (Cut-first aside, 0:15) `/what-if`: "What if SUP-1008 can't deliver for 7 days?" -> run -> estimate + assumptions panel.

**Narration:**
> "The Recovery Planning Agent - also in Agentstudio - looks at qualified alternate suppliers, inventory in other locations, cost and lead time, and ranks the options. Option one: move 400 units to SUP-2001; lead time and cost delta are estimates, and it says what they're based on. These are synthetic numbers. Nothing changes yet - the agent can recommend, it can never execute. I'll send it for approval."
> (Aside) "Planners can also ask 'what if' - a 7-day outage - and see the estimate with its assumptions, without creating anything."

**Boomi shown:** Agentstudio (second agent; optional quick switch to its run in the Agentstudio tab).
**Fallback:** same as scene 3. No viable option returned -> show the "no viable option" reason - that is a feature (TC-05), narrate it as such, then open `RC-000045`.

## Scene 5 - Procurement manager approves in Flow (1:00, total 5:45)
**Clicks:**
1. Switch to Boomi **Flow** tab (logged in as procurement manager): the approval task for this case - summary, option #1, cost delta, evidence link.
2. Show the four choices: Approve / Reject / Request change / Escalate. Type comment "Approved - expedite with SUP-2001". Click **Approve**.
3. Switch to SaaS tab 2 (`manager` profile) `/approvals`: decision recorded, approver, time, comment. Case status `APPROVED` -> `EXECUTING`.

**Narration:**
> "Here's the rule: no ERP change without a human. Boomi Flow routes the decision to the procurement manager, with the evidence attached. She can approve, reject, ask for changes or escalate. Approved. The decision, the approver and the comment are recorded in SupplyGuard - and only now is execution allowed."

**Boomi shown:** Flow (approval app, decision).
**Fallback:** Flow down -> approve in SaaS `/approvals` as `manager`; Django triggers the Boomi execution after the decision (CONTRACTS 8). Narrate: "The same approval, in our Approval Center."

## Scene 6 - Boomi updates the ERP, response verified (0:55, total 6:40)
**Clicks:**
1. Boomi **Process Reporting**: the PO-update process run - PATCH to mock ERP with `Idempotency-Key`, success.
2. Mock ERP tab: refresh `GET /erp/purchase-orders/PO-1001` -> `supplier_id` now `SUP-2001` (and/or new expected date).
3. SaaS `/risk/:id`: execution result `RECOVERED`, `recovery.status` event.
4. (Cut-second) Boomi **API Management** dashboard: calls between SaaS and Boomi, API key, rate-limit policy, request count for this run.

**Narration:**
> "Boomi Integration writes the approved change to the ERP - once, with an idempotency key, so a retry can never double-order. Here's the PO in the ERP: supplier changed to SUP-2001. Boomi reports the result back, the case is Recovered, and a recovery.status event goes out on Event Streams. Every call between our SaaS and Boomi went through Boomi API Management - keys, rate limits and analytics."

**Boomi shown:** Integration (write + callback), Event Streams (`recovery.status`), API Management (dashboard).
**Fallback:** API Management down -> Boomi Web Services Server listener with basic auth (CONTRACTS 8); skip step 4 and say "calls go through the Boomi listener". ERP write fails -> case shows `EXECUTION_FAILED`; as `manager` click **Retry** (allowed only for retryable errors) - this is a governance moment, narrate it. If retry also fails, show the audit of the failure and move on.

## Scene 7 - Back to the dashboard - detected, identified, approved, updated, audited (0:50, total 7:30)
**Clicks:**
1. `/` - KPI tiles updated: case recovered, `[measured: detection-to-recovery time for this run]` shown on the case.
2. `/audit` - filter by the correlation ID from scene 2: one timeline - event received, case created, analysis validated, recommendation, approval (who/when), ERP write, recovered.
3. `/integrations` - all connections green (one glance).
4. (`/settings` only if asked - thresholds per tenant.)

**Narration:**
> "Back where we started. Detected, identified, explained, approved, updated - and audited. One correlation ID ties the Event Streams message, both agent runs, the Flow approval and the ERP write together. That's what an auditor or a CFO asks for."

**Boomi shown:** Integration Center summarises all services' health.
**Fallback:** Audit filter slow -> scroll the unfiltered audit list (newest first).

## Scene 8 - Closing line (0:20, total 7:50)
**Screen:** SaaS `/` or title slide.
> "SupplyGuard AI doesn't just tell enterprises that their supply chain is at risk. It helps them recover before the disruption becomes a business crisis. And it ships as a Boomi Marketplace accelerator, so any Boomi customer can start in days."

---

## Boomi service coverage
| Service | Visible moment | Scene / time | How it is shown | Fallback if down |
|---|---|---|---|---|
| Integration | Intake/correlation run; PO write + callback | 2 (~1:40), 6 (~5:55) | Process Reporting runs; mock ERP PO before/after | none - core; play video shot |
| Event Streams | `supplier.disruption` payload; `recovery.status` event | 2 (~1:30), 6 (~6:20) | Topic view with payload + correlation_id | API Management endpoint triggers process directly |
| Agentstudio | Supplier Risk Analyst run; Recovery Planning Agent run | 3 (~3:15), 4 (~4:00) | Agent run history, tool calls, JSON output | Django + Claude API, same schemas, said honestly |
| Flow | Approval task, Approve click | 5 (~5:00) | Flow app as procurement manager | SaaS `/approvals` + Django triggers execution |
| API Management | Gateway dashboard: keys, rate limits, call counts | 6 (~6:30), mentioned in 2 | API dashboard | Web Services Server listener, basic auth |
| Data Hub (optional) | SUP-1008 golden record | 1 (~1:00) | Data Hub record view | Skip (optional) |

## SaaS screen coverage
| Route | Scene |
|---|---|
| `/` | 0, 1, 2, 7, 8 |
| `/suppliers` (+ detail) | 1 |
| `/risk` | 2, 3 |
| `/risk/:id` | 3, 4, 6 |
| `/recommendations` | 4 |
| `/approvals` | 5 |
| `/what-if` | 4 (aside, cut first) |
| `/integrations` | Setup, 7 |
| `/audit` | 7 |
| `/settings` | Q&A only |

## Rehearsal log
Acceptance (R-11): two timed rehearsals under 8:00. Record every run.

| Date | Duration | Fallbacks used | Issues / fixes |
|---|---|---|---|
| | | | |
| | | | |
