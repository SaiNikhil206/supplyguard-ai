# SupplyGuard AI - Judge Q&A Prep (DRAFT v0.1)

Draft answers by Roop. Answers marked **OWNER: Nikhil/Uday — confirm** need the named owner to check the technical detail before the S-03 dry run. Keep answers to ~30 seconds; offer to show the screen where possible.

## Architecture
1. **Why Boomi instead of calling the ERP from Django directly?**
   Boomi owns every system boundary: ERP reads/writes (Integration), events (Event Streams), agents (Agentstudio), approvals (Flow), API governance (API Management). The SaaS keeps business logic and UI. A customer swaps the ERP by changing Boomi processes, not our code.
2. **What happens end to end when an event arrives?**
   Event -> API Management -> Event Streams `supplier.disruption` -> Boomi process pulls POs/inventory -> `POST /internal/risk-cases` -> impact engine creates RiskCase + affected POs -> agents -> validated analysis/recommendations -> Flow approval -> idempotent ERP PATCH -> result callback -> `recovery.status`. One correlation ID throughout. **OWNER: Uday — confirm** process names and order.
3. **How do you handle duplicates and retries?**
   Duplicate `event_id` returns the existing case, no new one. ERP writes carry an `Idempotency-Key`. Retry is allowed only from `EXECUTION_FAILED` and only for retryable errors. **OWNER: Uday — confirm** how the idempotency key is built.
4. **What if a Boomi service is down?**
   Each one has a documented fallback with the same contracts (CONTRACTS section 8): e.g. Agentstudio -> Django calls Claude with the same schemas; Flow -> SaaS Approval Center. We say openly which path ran.
5. **Is the ERP real?**
   No - a mock ERP (FastAPI) with realistic supplier/PO/inventory/alternate-supplier endpoints and a chaos mode for failure tests. Real ERP = new Boomi connector, same canonical model.

## AI governance and hallucination control
6. **How do you stop the AI from hallucinating?**
   Agents return JSON against a schema; a validator rejects any option whose IDs, quantities or prices don't exist in the ERP snapshot; every claim is tagged FACT/ESTIMATE/ASSUMPTION/MISSING_DATA; facts carry an evidence pointer. Rejected output is never stored as actionable. **OWNER: Nikhil — confirm** validator rules and what happens on rejection (re-ask vs. fail).
7. **What if there is no good option?**
   The agent returns no options plus `no_viable_option_reason`; the UI shows it. Better no answer than a made-up one. **OWNER: Nikhil — confirm** this path is tested (TC-05).
8. **Can the AI change a PO on its own?**
   No. No ERP write without a recorded approval by a Procurement Manager; state changes only through the workflow transition service, which writes an audit event every time.
9. **Which model and how accurate is it?**
   Agents run in Boomi Agentstudio; the fallback uses Claude (claude-sonnet-5-5) with the same schemas. Accuracy on our synthetic scenarios: `[measured: validator pass rate / scenarios]`. We don't claim accuracy beyond what we measured. **OWNER: Nikhil — confirm** model config in Agentstudio and test numbers.
10. **How are the risk score and cost/lead-time estimates computed?**
   Impact engine computes affected POs and exposure deterministically from ERP data; the agent explains and ranks; estimates state their basis. **OWNER: Nikhil — confirm** which parts are deterministic vs. model-generated.

## Security and tenancy
11. **How is tenant isolation enforced?**
   Tenant comes only from the JWT claim (users) or the API key mapping (Boomi/system); never from body or query. Every tenant-owned query is filtered; a mismatching `tenant_id` in an event is a 403. **OWNER: Uday — confirm** enforcement point (middleware/mixin) and tests.
12. **Roles?**
   Admin, Procurement Manager (approves), Ops Manager (what-if, can't approve), Viewer (read-only), System (API key, event intake + callbacks). Can demo with the `viewer` login.
13. **Secrets and keys?**
   No secrets in git or logs; `.env` + `.env.example`; Boomi API keys managed in API Management with rate limits. Refresh token in localStorage is a known hackathon trade-off; plan is httpOnly cookies. **OWNER: Uday — confirm** key rotation story.
14. **Audit - can you prove who did what?**
   Yes: Audit Center filtered by correlation ID shows event, analysis, recommendation, approval (user, time, comment), ERP write and result.

## Scaling and operations
15. **How does it scale to many tenants / many events?**
   Event Streams decouples intake; Boomi processes scale on the Atom/Molecule; Django is stateless behind the gateway; PostgreSQL with tenant-indexed tables. Measured so far: `[measured: events/min in load test, if run]`. **OWNER: Uday — confirm** runtime (Atom vs Molecule/cloud) and any load test.
16. **Latency from event to case?**
   `[measured: p50/p95 event-to-case]` and `[measured: analysis time]` from rehearsals. **OWNER: Nikhil/Uday — confirm** numbers after S-03.
17. **Monitoring?**
   Integration Center shows connection health; Boomi Process Reporting for runs; correlation ID in every log line. **OWNER: Uday — confirm**.

## Marketplace and business
18. **What exactly goes on the Marketplace?**
   Integration processes, event processing, both agents, approval workflow, API definitions + config templates, sample data + test instructions, architecture diagram, deployment and onboarding guides, demo video. It's a tested submission candidate; publishing needs Technology Partner approval, a separate gate.
19. **How is this different from existing listings?**
   Others predict, monitor EDI or sync data. We close the loop: predict, understand, recover, verify - with governed human approval.
20. **Business model?**
   Free starter accelerator -> paid SaaS subscription -> enterprise customization.
21. **How long would a customer take to install it?**
   Target: follow only the install guide on a clean Boomi account (R-12 acceptance). Time: `[measured: R-12 dry-run duration]`. **OWNER: Nikhil/Uday — confirm** after the R-12 dry run.

## Items needing owner input (summary)
- Nikhil: Q6, Q7, Q9, Q10, Q16, Q21
- Uday: Q2, Q3, Q11, Q13, Q15, Q16, Q17, Q21
- Also in DEMO_SCRIPT: reset command names (Uday: Django demo reset; Nikhil: mock ERP seed reload), Postman fallback collection path (Uday).
