# SupplyGuard AI - Project Plan (45-day window)

**Product:** SupplyGuard AI - AI-powered Supplier Risk Intelligence & Supply Chain Recovery
**Event:** Boomi World 2027 Hackathon POC + Boomi Marketplace submission candidate
**Window:** Day 1 = Thu 19 Nov 2026 -> Day 43 = Thu 31 Dec 2026 (hard submission date). Days 44-45 (1-2 Jan) are NOT usable; treat 31 Dec as final.
**Team:** Roop (frontend), Nikhil (data/AI), Uday (backend/integration) - no team lead; shared tasks have a driver

Sources of truth:
- `docs/BRD_HLD_LLD.md` (requirements, HLD, LLD - converted from the .docx in `docs/source/`)
- `docs/PRODUCT_STRATEGY.md` (why this product, competition, demo story)
- `docs/CONTRACTS.md` (interfaces everybody codes against)

---

## 1. One-line pitch

> SupplyGuard AI doesn't just tell enterprises that their supply chain is at risk. It helps them recover - **Predict -> Understand -> Recover -> Verify** - with governed AI agents, human approval and Boomi orchestration.

## 2. Work split (three equal streams)

| Member | Background | Stream | Owns (folders) | Boomi services | Tasks / est. days |
|---|---|---|---|---|---|
| **Roop** | React / frontend | SaaS UI & demo | `frontend/`, `backend/apps/portal/` (read APIs for the screens), `boomi/flow/`, `boomi/marketplace/`, CI, demo script | Flow | 12 tasks / ~22.5 d |
| **Nikhil** | Data engineer (Python, AI/ML) | Data & AI | `data/`, `mock-erp/`, `ai/`, `backend/apps/intelligence/`, `backend/apps/workflow/`, `boomi/agents/`, `boomi/processes/correlation/`, `tests/e2e/` | Agentstudio, Data Hub (optional), correlation process | 14 tasks / ~24 d |
| **Uday** | Data engineer (Python, AI/ML) | Backend & integration | `backend/` core (project, `tenants`, `accounts`, `core`, `audit`, `integrations`), `boomi/processes/`, `boomi/api/`, deployment | Integration, Event Streams, API Management | 12 tasks / ~22 d |

Shared work is in `tasks/SHARED.md` (no lead - each shared task has a driver). Detailed tasks: `tasks/ROOP.md`, `tasks/NIKHIL.md`, `tasks/UDAY.md`.

Why this split: it follows each person's background. Roop owns everything the user sees (React screens, the Flow approval screens, the demo) plus the thin read APIs behind those screens. Nikhil and Uday split the Python/data side: Nikhil takes the data and AI (dataset, mock ERP, impact scoring, agents, validation, workflow rules), Uday takes the platform and pipes (Django core, security, Boomi integration, events, APIs, deployment). Claude writes most of the code and explains it to each person in their own terms (CLAUDE.md section 2). The hard coupling points are the **contracts** (`docs/CONTRACTS.md`) and the **Django models** (Uday, U-03) - both are scheduled for the first 4 days. Roop's frontend starts on Day 1 against mock data (MSW), so it does not wait for the backend.

## 3. Sprint calendar

| Sprint | Dates (2026) | Days | Milestone (demo at end of sprint) |
|---|---|---|---|
| **S0 Foundation** | 19-23 Nov | 1-5 | Contracts frozen v1, repo scaffolds run locally, mock ERP + seed data, Boomi env verified |
| **S1 Data flowing** | 24-30 Nov | 6-12 | Disruption event -> Django -> Boomi Event Streams -> ERP data fetched -> RiskCase + AffectedPOs stored; login + tenant isolation work |
| **S2 AI working** | 1-7 Dec | 13-19 | Both agents return schema-valid output for the scenario; dashboard + supplier + risk screens show real data |
| **S3 Recovery lifecycle** | 8-14 Dec | 20-26 | Approve in Flow/UI -> Boomi writes PO change to mock ERP -> verified -> RECOVERED + audit trail |
| **S4 Product complete** | 15-20 Dec | 27-32 | What-if simulator, Integration/Audit/Settings screens, retry flow, hosted deployment |
| **S5 Hardening** | 21-26 Dec | 33-38 | TC-01..TC-10 pass, security review, guardrail tests, performance (<10 s event-to-risk) |
| **S6 Submission** | 27-31 Dec | 39-43 | Demo video, deck, Marketplace package, install guide, final rehearsal, submit |

Rule: **end-to-end first, polish later.** One working disruption -> recovery path by 14 Dec beats eight half-finished screens.

## 4. Critical path

```
S-01 Contracts ─┬─> U-03 Models ─┬─> U-06 Event intake ─> U-07/U-08 ERP reads + events ─> N-08 Correlation ─┐
                │                 ├─> N-04 Impact engine ─────────────────────────────────────────────────┤
N-03 Mock ERP ──┘                 └─> R-02 Read APIs ─> R-03/R-04 Screens                                    │
                                                                                                              v
                    N-05/N-06 Agents ─> N-07 Validator ─> N-10 Decisions + R-06 Flow ─> U-10 Execution ─> E2E demo
```

## 5. Definition of Done (every task)

1. Acceptance criteria in the task file are all ticked.
2. Tests written/updated and passing locally (`pytest` / `npm test`), or for Boomi: the process test run is recorded in `boomi/TEST_LOG.md`.
3. Contracts unchanged, or `docs/CONTRACTS.md` updated in the same PR with a changelog line and the other two members tagged.
4. Task file updated: `Status: done`, `Done in:` commit hash, Handoff section refreshed.
5. Merged into `collaboration` through a PR.

## 6. Risks we actively manage

| Risk | Mitigation |
|---|---|
| A Boomi service is not licensed/enabled | U-01 verifies on Day 1-2. Fallbacks listed in `docs/CONTRACTS.md` section 8 (e.g. Agent Garden unavailable -> Django calls Claude API with same schema; Flow unavailable -> approval in SaaS UI only). |
| Boomi cloud atom cannot reach localhost | Mock ERP + backend get a public URL (tunnel in S1, hosted in S4) - U-12. |
| AI output invents data | Schema validation + fact cross-check (N-07) + "missing data" fields required by schema. |
| Someone does not understand code Claude wrote | Claude explains each task in the member's own terms (CLAUDE.md section 2); reviewer subagent + one human review per PR. |
| Integration day surprises | Sprint-end integration demo every 7 days (S-02). |
| Someone is blocked/away | Every task file has a Handoff section; anybody can run `/resume <name>` and continue. |
