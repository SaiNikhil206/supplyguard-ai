# SupplyGuard AI - Demo Video Shot List (DRAFT v0.1)

Matches `docs/DEMO_SCRIPT.md` scene by scene. Target length 7:50 (hard limit 8:00). Record at 1920x1080, browser zoom 125 %. Persistent corner overlay on every SaaS shot: **"Illustrative synthetic data"**. This video is also the live-demo fallback and a Marketplace package item.

| # | Scene | Duration | Running | Screen / source | Overlay text | Voice-over |
|---|---|---|---|---|---|---|
| 1 | 0 | 0:20 | 0:20 | Title card -> SaaS `/` fade in | "SupplyGuard AI - Predict, Understand, Recover, Verify" | "A supplier's factory catches fire at 10 a.m. ... with Boomi doing the heavy lifting." |
| 2 | 1 | 0:25 | 0:45 | SaaS `/` KPI tiles (zoom on tiles) | "100 suppliers - 500 POs - 20 shipments (synthetic)" | "This is Acme's normal day ... mapped to one canonical model." |
| 3 | 1 | 0:25 | 1:10 | `/suppliers` -> search SUP-1008 -> detail; optional Data Hub golden record | "Boomi Integration: ERP -> canonical model" / "Boomi Data Hub (optional)" | "SUP-1008 is a key supplier - remember this name." |
| 4 | 2 | 0:20 | 1:30 | `/` Simulate Supplier Disruption dialog -> Send -> toast | "Factory outage - SUP-1008 - 48 h" | "Line 2 at SUP-1008 is on fire ..." |
| 5 | 2 | 0:25 | 1:55 | Boomi Event Streams topic `supplier.disruption`, payload open | "Boomi Event Streams: supplier.disruption" + highlight correlation_id | "It lands on Boomi Event Streams ... a correlation ID we'll follow all the way to the ERP." |
| 6 | 2 | 0:20 | 2:15 | Boomi Process Reporting run -> `/risk` new case RECEIVED -> ANALYZING | "Boomi Integration: pulls POs + inventory" | "Boomi Integration picks it up ... a risk case is open." |
| 7 | 3 | 0:40 | 2:55 | `/risk/:id` analysis: risk score, affected POs, evidence tags, hover a FACT | "FACT - ESTIMATE - ASSUMPTION - MISSING DATA" | "It's not chat text: every statement is tagged ..." |
| 8 | 3 | 0:40 | 3:35 | Boomi Agentstudio: Supplier Risk Analyst run, tool calls, JSON | "Boomi Agentstudio: Supplier Risk Analyst" / "Validator checks every ID, qty, price" | "Before anything is stored, a validator checks ..." |
| 9 | 4 | 0:40 | 4:15 | `/recommendations` ranked options, expand #1 | "Recovery Planning Agent - ranked options (estimates)" | "The Recovery Planning Agent ... ranks the options." |
| 10 | 4 | 0:15 | 4:30 | Submit for approval -> PENDING_APPROVAL | "Agents recommend. Humans decide." | "Nothing changes yet - the agent can recommend, it can never execute." |
| 11 | 4 | 0:15 | 4:45 | `/what-if` 7-day outage -> estimate + assumptions (cut first if long) | "What-if Recovery Simulator" | "Planners can also ask 'what if' ..." |
| 12 | 5 | 0:40 | 5:25 | Boomi Flow approval task -> comment -> Approve | "Boomi Flow: procurement approval" | "No ERP change without a human ... Approved." |
| 13 | 5 | 0:20 | 5:45 | SaaS `/approvals` decision row; status APPROVED -> EXECUTING | "Decision recorded: who, when, why" | "The decision, the approver and the comment are recorded ..." |
| 14 | 6 | 0:25 | 6:10 | Boomi Process Reporting PO-update run (Idempotency-Key) | "Boomi Integration: idempotent ERP write" | "Boomi Integration writes the approved change - once ..." |
| 15 | 6 | 0:15 | 6:25 | Mock ERP PO-1001 JSON before/after (split screen) | "PO-1001: SUP-1008 -> SUP-2001" | "Here's the PO in the ERP: supplier changed." |
| 16 | 6 | 0:15 | 6:40 | `/risk/:id` RECOVERED + Boomi API Management dashboard | "Boomi API Management: keys, rate limits, analytics" + "Event Streams: recovery.status" | "Every call ... went through Boomi API Management." |
| 17 | 7 | 0:35 | 7:15 | `/audit` filtered by correlation ID -> timeline | "One correlation ID - end to end" | "Detected, identified, explained, approved, updated - and audited." |
| 18 | 7 | 0:15 | 7:30 | `/` updated KPIs + `/integrations` all green | "Detection to recovery: [measured: ...]" | "That's what an auditor or a CFO asks for." |
| 19 | 8 | 0:20 | 7:50 | Closing card: logo + "Available as a Boomi Marketplace accelerator" | Closing line text | "SupplyGuard AI doesn't just tell enterprises ... business crisis." |

Total: 7:50.

Recording notes:
- Record each shot separately; re-take any shot where a live call is slow instead of cutting mid-shot.
- If a section-8 fallback was used during recording, the overlay must say so (e.g. "Approval via SaaS Approval Center - Flow fallback").
- Blur API keys and tokens in API Management and Postman shots.
