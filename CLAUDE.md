# CLAUDE.md - SupplyGuard AI (Boomi World 2027 Hackathon)

You are working in a 3-person team repo. Read this whole file at the start of every session. It is short on purpose; details live in the linked docs.

## 1. What we are building
SupplyGuard AI: multi-tenant SaaS (React + Django REST + PostgreSQL) with a Boomi backend (Integration, Event Streams, Agentstudio, Flow, API Management, optional Data Hub) that detects supplier disruptions, finds affected purchase orders, explains risk with evidence, recommends recovery options, gets human approval and executes the approved change in a (mock) ERP - with a full audit trail.
Hard deadline: **31 Dec 2026**. Plan + sprints: `docs/PROJECT_PLAN.md`. Requirements: `docs/BRD_HLD_LLD.md`. Interfaces: `docs/CONTRACTS.md`.

## 2. Who owns what
There is no team lead; shared tasks have a named driver (`tasks/SHARED.md`).

| Member | Background | Task file | Branch prefix | Owns |
|---|---|---|---|---|
| Roop | Frontend (React) | `tasks/ROOP.md` | `roop/` | `frontend/`, `backend/apps/portal/` (UI read APIs), `boomi/flow/`, `boomi/marketplace/`, `.github/workflows/ci.yml`, `docs/DEMO_SCRIPT.md` |
| Nikhil | Data engineer (Python, AI/ML) | `tasks/NIKHIL.md` | `nikhil/` | `ai/`, `data/`, `mock-erp/`, `backend/apps/intelligence/`, `backend/apps/workflow/`, `boomi/agents/`, `boomi/processes/correlation/`, `tests/e2e/` |
| Uday | Data engineer (Python, AI/ML) | `tasks/UDAY.md` | `uday/` | `backend/` project + `apps/{tenants,accounts,core,audit,integrations}`, `boomi/processes/` (except `correlation/`), `boomi/api/`, `deploy/`, `docker-compose.yml`, `docs/BOOMI_ENV.md`, `docs/INSTALL.md` |
| Everyone | - | `tasks/SHARED.md` | driver's prefix | `docs/CONTRACTS.md` (changes need all 3) |

**Identify the member** from the command argument (`/resume nikhil`), else from `git config user.name`, else ask. Work only on that member's tasks. Do not edit another stream's folders - if you need a change there, write it in your task's Notes and in the Handoff "Blockers" line, and tell the user.

**Explain in the member's language.** Claude writes most of the code, so the person must still understand and verify it. At the start of each task give a short "what this is and why" (max 6 lines) in that member's terms, and before asking them to check something, say exactly what to look at.
- Roop (React): explain backend, Boomi and data ideas through frontend analogies - components, props/state, API calls, forms, routing.
- Nikhil and Uday (Python data engineers): explain Django, Boomi and React ideas through data-pipeline analogies - ETL steps, schemas, jobs, connectors, DataFrames.

## 3. Session protocol (mandatory)
**Start:** `git fetch && git checkout collaboration && git pull` -> `python scripts/progress.py <member>` -> read that member's task file (Handoff block first) -> pick the `in-progress` task, else the first `todo` task whose Depends are all `done` -> create/checkout its branch from `collaboration`.
**During:** follow section 4 (advisor + subagents). Commit small, often, with the trailers in section 5.
**End (never skip, even if the work is unfinished):** run `/handoff` - it updates the task file Handoff block + Status + checkboxes, appends to `progress/SESSION_LOG.md`, regenerates `PROGRESS.md`, commits and pushes. Unpushed work does not exist for the rest of the team.

Slash commands in `.claude/commands/`: `/resume <member>`, `/status [member|all]`, `/handoff`, `/done <task-id>`, `/sync`.

## 4. Advisor + nested subagents (how to do the work)
The main session is the **advisor** and runs on **Opus 5.5** (`/model opus`). The advisor plans, decides, reviews and integrates; it delegates bulk work to subagents defined in `.claude/agents/` with the right model and effort:

| Subagent | Model / effort | Use for |
|---|---|---|
| `investigator` | haiku / low | find files, map code, read docs, summarize logs |
| `implementer` | sonnet / medium | write code + tests for one well-specified subtask |
| `boomi-builder` | sonnet / medium | Boomi process/profile/API/Flow/agent specs and exports |
| `test-runner` | haiku / low | run test suites, report failures tersely |
| `reviewer` | opus / high | review a diff vs task acceptance + CONTRACTS + security |
| `docs-writer` | haiku / low | task-file updates, READMEs, session log |

Rules: break the task into subtasks of <= 1-2 files each; run independent subtasks in parallel (use `isolation: worktree` when two implementers touch the same app); always end with `reviewer` before marking `review`/`done`. Each task's "Model hint" says where the weight is. Full guide: `docs/AI_WORKFLOW.md`.

## 5. Git rules
- Branches: `main` (milestones only, tagged m1..m6, v1.0) <- `collaboration` (integration, always runnable) <- `<member>/<TASK-ID>-<slug>` (one per task) <- optional `<member>/<TASK-ID>-<slug>--<sub>` for parallel subagent work, merged back into the task branch.
- Never commit directly to `main` or `collaboration`. PR task branch -> `collaboration`; 1 review from another member (or `reviewer` subagent output pasted in the PR when the others are offline).
- Commit message format (Conventional Commits + trailers - `scripts/progress.py` reads the trailers):
  ```
  feat(integrations): accept disruption events with dedupe

  What: POST /events/disruptions, API-key auth, event_id dedupe.
  Left: Boomi publish call stubbed; next is BoomiClient retry.

  Task: R-06
  Status: in-progress
  Member: roop
  ```
  `Status:` one of `in-progress | review | done | blocked`.
- See `docs/GIT_WORKFLOW.md` for PR flow, conflict handling and milestones.

## 6. Engineering rules
- Code against `docs/CONTRACTS.md`. Changing it = PR touching that file + changelog line + tell both teammates.
- Tenant comes from JWT claims or API key, never from request body/query. Every tenant-owned query is tenant-filtered.
- No ERP write without a recorded approval. RiskCase state changes only via `apps.workflow.services.transition()`.
- AI output is schema-validated and fact-checked before it is stored as actionable; missing data is stated, never invented.
- No secrets in git or logs. Use `.env` (gitignored) and `.env.example`.
- Tests with every feature (pytest / Vitest). Do not mark a task `done` with failing tests.
- Stack: Python 3.12, Django 5, DRF, PostgreSQL 16, FastAPI (mock ERP), React 18 + Vite + TS + Tailwind, TanStack Query.

## 7. Updating progress (this is how the team knows where we are)
- Task status lives ONLY in `tasks/<MEMBER>.md` (`- **Status:** ...` line) - keep the format exactly.
- `PROGRESS.md` is generated: `python scripts/progress.py all --write`. Never hand-edit it.
- `progress/SESSION_LOG.md` is append-only, one entry per session.
- Asking "what has Nikhil done / what's pending?" -> run `python scripts/progress.py nikhil` and answer from its output plus the Handoff block.
