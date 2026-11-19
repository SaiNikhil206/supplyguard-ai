# Tasks - Nikhil (AI Intelligence & Workflow)

**Stream:** Impact/risk engine, Boomi Agentstudio agents, agent output validation, what-if simulator, Boomi Flow approvals, case state machine, demo script.
**Owns:** `ai/`, `backend/apps/intelligence/`, `backend/apps/workflow/`, `boomi/flow/`, `boomi/agents/`, `docs/DEMO_SCRIPT.md`

> Status values: `todo` · `in-progress` · `blocked` · `review` · `done`. Only change the `Status`, `Done in`, checkboxes and Notes lines - keep the format, `scripts/progress.py` parses it.
> Model hint = what the advisor (Opus 5.5) should delegate the bulk of the work to. See `docs/AI_WORKFLOW.md`.

## Handoff
<!-- Overwrite this block at the end of EVERY session (run /handoff). Newest state only; history goes to progress/SESSION_LOG.md -->
- **Last updated:** 2026-11-19 (setup)
- **Current task:** -
- **Branch:** -
- **Where I left off:** Project structure and task split created. Nothing implemented yet.
- **Next step:** Start N-01 today (drafting the schemas is your input to the S-01 contracts freeze - review CONTRACTS sections 6-7 while doing it).
- **Blockers:** none

---

### N-01: Agent I/O JSON schemas + fixtures
- **Status:** todo
- **Sprint:** S0 (19-23 Nov) | **Est:** 1d | **Depends:** -
- **Branch:** `nikhil/N-01-agent-schemas`
- **Model hint:** opus / high (schema design is a contract)
- **Deliverables:** `ai/schemas/risk_analysis.schema.json`, `ai/schemas/recovery_plan.schema.json`, `ai/schemas/agent_input.schema.json` (what the agents receive); valid + invalid fixtures in `ai/fixtures/`; schema test.
- **Acceptance:**
  - [ ] Schemas match CONTRACTS section 6 exactly
  - [ ] Required `missing_data` / `assumptions` / `evidence` fields enforced
  - [ ] Invalid fixtures fail validation in tests
- **Done in:** -
- **Notes:** -

### N-02: Deterministic impact + risk scoring engine
- **Status:** todo
- **Sprint:** S1 (24-30 Nov) | **Est:** 3d | **Depends:** U-02, R-03
- **Branch:** `nikhil/N-02-impact-engine`
- **Model hint:** opus / high for the scoring design, sonnet / medium to implement + tests
- **Deliverables:** `backend/apps/intelligence/impact.py`: given event + ERP snapshot -> affected POs (affected_qty, estimated_delay, exposure_amount), inventory coverage per item, shortage flags, risk_score 0-100 with documented formula and tenant thresholds; `POST /internal/risk-cases` handler logic (endpoint shell is in Roop's app, calls this service).
- **Acceptance:**
  - [ ] TC-03: multiple open POs all evaluated
  - [ ] TC-04: sufficient inventory -> no shortage claimed
  - [ ] Demo scenario numbers match `data/README.md`
  - [ ] Pure functions, 90%+ line coverage on `impact.py`
- **Done in:** -
- **Notes:** -

### N-03: Supplier Risk Analyst agent (Agentstudio)
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 2d | **Depends:** N-01, R-01
- **Branch:** `nikhil/N-03-risk-analyst`
- **Model hint:** opus / high (prompt + guardrails); use the boomi-agentstudio skill if installed
- **Deliverables:** agent in Agentstudio with instructions, tools (ERP lookups via R-04 processes), guardrails: no invented capacity/price/dates, separate facts vs estimates, must fill `missing_data`. Prompt + config versioned in `boomi/agents/risk_analyst/`.
- **Acceptance:**
  - [ ] Output for demo scenario validates against `risk_analysis.schema.json`
  - [ ] Every claim has an `evidence` entry pointing to snapshot data
  - [ ] 5 adversarial prompts (asking it to guess capacity etc.) -> it reports missing data instead
- **Done in:** -
- **Notes:** -

### N-04: Recovery Planning agent (Agentstudio)
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 2d | **Depends:** N-01, N-03
- **Branch:** `nikhil/N-04-recovery-agent`
- **Model hint:** opus / high
- **Deliverables:** agent comparing ALTERNATE_SUPPLIER, INVENTORY_TRANSFER, REVISED_SCHEDULE, SPLIT_ORDER; ranks by urgency, inventory, qualification, cost, priority; config in `boomi/agents/recovery_planner/`.
- **Acceptance:**
  - [ ] Demo scenario -> at least 2 ranked viable options (AC-04)
  - [ ] TC-05 scenario -> `options: []` + `no_viable_option_reason`
  - [ ] Output validates against `recovery_plan.schema.json`
- **Done in:** -
- **Notes:** -

### N-05: Agent output validator + persistence
- **Status:** todo
- **Sprint:** S2 (1-7 Dec) | **Est:** 1.5d | **Depends:** N-01, N-02, U-02
- **Branch:** `nikhil/N-05-validator`
- **Model hint:** sonnet / medium; opus / high review
- **Deliverables:** `backend/apps/intelligence/validation.py` + `POST /internal/risk-cases/{id}/analysis`: JSON-schema check, cross-check every referenced supplier/PO/item/qty/price against the stored snapshot, flag unsupported options (`status=UNSUPPORTED`, not actionable), persist Recommendation rows, transition case to RECOMMENDATION_READY.
- **Acceptance:**
  - [ ] Option referencing a non-existent supplier is flagged, not shown as actionable
  - [ ] Raw agent output stored for audit (AC-07)
  - [ ] Tests for valid, schema-invalid, and fact-mismatch payloads
- **Done in:** -
- **Notes:** -

### N-06: Agent invocation wiring + offline fallback
- **Status:** todo
- **Sprint:** S2-S3 (5-9 Dec) | **Est:** 1.5d | **Depends:** N-03, N-04, R-07
- **Branch:** `nikhil/N-06-agent-invocation`
- **Model hint:** sonnet / medium (use the claude-api skill for the fallback client)
- **Deliverables:** Boomi step (in R-07 process) or Agent Garden API call that runs both agents in sequence; Django fallback `apps.intelligence.agents` using Claude API with the same schemas (CONTRACTS section 8) behind setting `AGENT_BACKEND=boomi|claude|mock`; `mock` returns fixtures for offline demo.
- **Acceptance:**
  - [ ] All three backends produce schema-valid output for the demo scenario
  - [ ] Switching backend needs only an env var
- **Done in:** -
- **Notes:** -

### N-07: What-if simulator backend
- **Status:** todo
- **Sprint:** S3 (8-14 Dec) | **Est:** 1.5d | **Depends:** N-02
- **Branch:** `nikhil/N-07-what-if`
- **Model hint:** sonnet / medium
- **Deliverables:** `POST /what-if` (supplier_id, duration_days, event_type) and `POST /risk-cases/{id}/what-if`; reuses impact engine on a fresh snapshot; returns affected POs, inventory gaps, exposure, best option estimate, assumptions; no DB writes except an audit row.
- **Acceptance:**
  - [ ] "Supplier A out for 7 days" returns in < 3 s on seed data
  - [ ] Response labels everything as estimate + lists assumptions (AC-03)
- **Done in:** -
- **Notes:** -

### N-08: Boomi Flow approval workflow
- **Status:** todo
- **Sprint:** S3 (8-14 Dec) | **Est:** 2.5d | **Depends:** N-05, R-01
- **Branch:** `nikhil/N-08-flow-approval`
- **Model hint:** sonnet / medium
- **Deliverables:** Flow app: approval task with evidence + options, Approve / Reject / Request changes, comment, escalation after N hours; on Approve calls R-09 process; on every decision calls `POST /recommendations/{id}/decision` (or Django calls Flow - pick one direction and document in `boomi/flow/README.md`). Fallback: SaaS-only approval.
- **Acceptance:**
  - [ ] Approve in Flow -> execution starts; Reject -> no execution
  - [ ] Decision visible in SaaS Approval Center and audit within 5 s
- **Done in:** -
- **Notes:** -

### N-09: Workflow app - state machine + decisions
- **Status:** todo
- **Sprint:** S3 (8-14 Dec) | **Est:** 2d | **Depends:** U-02, U-03, U-05
- **Branch:** `nikhil/N-09-state-machine`
- **Model hint:** opus / high design, sonnet / medium implement
- **Deliverables:** `backend/apps/workflow/services.py` `transition()` enforcing CONTRACTS section 7; `POST /recommendations/{id}/decision` with role check (`PROCUREMENT_MANAGER` only), creates Approval, triggers execution only on APPROVE; every transition audited.
- **Acceptance:**
  - [ ] Table-driven test covering every allowed and forbidden transition
  - [ ] TC-06: reject -> no execution call, comments audited
  - [ ] OPS_MANAGER / VIEWER cannot decide (403)
- **Done in:** -
- **Notes:** -

### N-10: Data Hub supplier golden record (OPTIONAL)
- **Status:** todo
- **Sprint:** S4 (15-20 Dec) | **Est:** 1.5d | **Depends:** R-01 (only if Data Hub enabled)
- **Branch:** `nikhil/N-10-data-hub`
- **Model hint:** sonnet / medium
- **Deliverables:** supplier model in Data Hub, match rule on name+tax id, 3 seeded duplicates resolved; integration process uses golden ID.
- **Acceptance:**
  - [ ] Duplicate suppliers in seed collapse to one golden record
  - [ ] If Data Hub not enabled: mark this task `done` with Notes "skipped - not licensed"
- **Done in:** -
- **Notes:** -

### N-11: AI governance + approval tests
- **Status:** todo
- **Sprint:** S5 (21-26 Dec) | **Est:** 1.5d | **Depends:** N-05, N-09
- **Branch:** `nikhil/N-11-ai-tests`
- **Model hint:** sonnet / medium write, haiku / low run
- **Deliverables:** tests for TC-04, TC-05, TC-06, hallucination/guardrail suite, unauthorized approval attempts; results added to `docs/TEST_REPORT.md`.
- **Acceptance:**
  - [ ] All listed TCs pass and are in the report
  - [ ] AC-03 evidence: screenshot or JSON showing facts vs estimates vs missing data
- **Done in:** -
- **Notes:** -

### N-12: Demo script, deck, video storyboard
- **Status:** todo
- **Sprint:** S6 (27-31 Dec) | **Est:** 2d | **Depends:** S-03 dry run
- **Branch:** `nikhil/N-12-demo-script`
- **Model hint:** opus / high for story, haiku / low for formatting
- **Deliverables:** `docs/DEMO_SCRIPT.md` (7-8 min, 7 scenes from PRODUCT_STRATEGY), slide deck outline, video shot list, Q&A prep (architecture, governance, Marketplace).
- **Acceptance:**
  - [ ] Two timed rehearsals under 8 min
  - [ ] Every Boomi service has a visible moment
- **Done in:** -
- **Notes:** -
