# SupplyGuard AI - Project Plan (45-day window)

**Product:** SupplyGuard AI - AI-powered Supplier Risk Intelligence & Supply Chain Recovery
**Event:** Boomi World 2027 Hackathon POC + Boomi Marketplace submission candidate
**Window:** Day 1 = Thu 19 Nov 2026 -> Day 43 = Thu 31 Dec 2026 (hard submission date). Days 44-45 (1-2 Jan) are NOT usable; treat 31 Dec as final.
**Team:** Roop (lead), Nikhil, Uday

Sources of truth:
- `docs/BRD_HLD_LLD.md` (requirements, HLD, LLD - converted from the .docx in `docs/source/`)
- `docs/PRODUCT_STRATEGY.md` (why this product, competition, demo story)
- `docs/CONTRACTS.md` (interfaces everybody codes against)

---

## 1. One-line pitch

> SupplyGuard AI doesn't just tell enterprises that their supply chain is at risk. It helps them recover - **Predict -> Understand -> Recover -> Verify** - with governed AI agents, human approval and Boomi orchestration.

## 2. Work split (three equal streams)

| Member | Stream | Owns (folders) | Boomi services |
|---|---|---|---|
| **Roop** (team lead) | Integration & Platform | `boomi/`, `mock-erp/`, `data/`, `backend/apps/integrations/`, deployment, Marketplace package | Integration, Event Streams, API Management |
| **Nikhil** | AI Intelligence & Workflow | `ai/`, `backend/apps/intelligence/`, `backend/apps/workflow/`, demo script | Agentstudio, Flow, Data Hub (optional) |
| **Uday** | SaaS Product (backend core + frontend) | `backend/` core (project, `tenants`, `accounts`, `core`, `audit`), `frontend/`, CI | - (consumes all via REST) |

Shared work is in `tasks/SHARED.md`. Detailed tasks: `tasks/ROOP.md`, `tasks/NIKHIL.md`, `tasks/UDAY.md`.

Why this split: each stream maps to one layer of the HLD, so the three of us rarely touch the same files. The only hard coupling points are the **contracts** (`docs/CONTRACTS.md`) and the **Django models** (Uday, U-02) - both are scheduled for the first 4 days so nobody is blocked later.

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
S-01 Contracts ─┬─> U-02 Models ─┬─> R-06 Event intake ─> R-05/R-07 Boomi correlation ─┐
                │                 ├─> N-02 Impact engine ───────────────────────────────┤
R-02 Mock ERP ──┘                 └─> U-04 Read APIs ─> U-07/U-08 Screens               │
                                                                                         v
                      N-03/N-04 Agents ─> N-05 Validator ─> N-08/N-09 Approval ─> R-09 Execution ─> E2E demo
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
| A Boomi service is not licensed/enabled | R-01 verifies on Day 1-2. Fallbacks listed in `docs/CONTRACTS.md` section 8 (e.g. Agent Garden unavailable -> Django calls Claude API with same schema; Flow unavailable -> approval in SaaS UI only). |
| Boomi cloud atom cannot reach localhost | Mock ERP + backend get a public URL (tunnel in S1, hosted in S4) - R-11. |
| AI output invents data | Schema validation + fact cross-check (N-05) + "missing data" fields required by schema. |
| Integration day surprises | Sprint-end integration demo every 7 days (S-02). |
| Someone is blocked/away | Every task file has a Handoff section; anybody can run `/resume <name>` and continue. |
