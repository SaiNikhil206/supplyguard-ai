# Boomi environment (U-01)

**Owner:** Uday. **Status:** checklist prepared by Claude - the platform checks below need someone logged in to the Boomi platform (https://platform.boomi.com). Fill in every `TODO`, tick the boxes, then commit with `Task: U-01`.

This file is the single source of truth for "what Boomi do we actually have". Every later Boomi task (U-07..U-11, N-05/N-06/N-08, R-06, R-12) reads it. Never put passwords, API tokens or shared secrets here - only names, IDs and yes/no facts. Credentials go into each member's `.env` (gitignored).

---

## 1. Account

| Item | Value |
|---|---|
| Account name | TODO |
| Account ID (Settings > Account Information, e.g. `acme-AB12CD`) | TODO |
| Account type (trial / partner / hackathon sandbox) and expiry date | TODO - expiry must be after 31 Dec 2026 |
| Platform region / base URL | TODO (e.g. `https://platform.boomi.com`) |
| Account admin (who can add users / enable services) | TODO |

## 2. Environments and runtime

| Item | Value |
|---|---|
| Environments (Manage > Environments) - name + classification (TEST/PROD) | TODO - we need at least one, suggest `SG-Dev` (TEST) |
| Runtime type: Boomi cloud atom / local atom / runtime cloud | TODO |
| Runtime name + attached environment | TODO |
| Runtime can reach the public internet over HTTPS (needed to call our tunnel / hosted URLs, U-12) | TODO yes/no |
| Can we add environment extensions (connection URL, credentials) on that runtime? | TODO yes/no |

If only a cloud atom is available, Boomi cannot reach `localhost`: the mock ERP and backend need a public HTTPS URL (tunnel in S1, hosted in S4 - task U-12).

## 3. Services

Check each one in the platform service switcher (top-left menu) and note how you verified it. "Enabled" means we can create and run something, not just see the tile.

| # | Service | Enabled? | How verified (what you created / ran) | Used by |
|---|---|---|---|---|
| 1 | Integration (processes, connectors, maps) | TODO | e.g. ran a "hello" process in Test Mode | U-07, U-08, U-10, U-11, N-08 |
| 2 | Event Streams (topics, publish/subscribe) | TODO | e.g. created topic `sg-test`, published 1 message | U-08 |
| 3 | Agentstudio / Agent Garden (AI agents) | TODO | e.g. opened Agent Garden, created a draft agent | N-05, N-06 |
| 4 | Flow (human approval UI) | TODO | e.g. created an empty Flow app and ran it | R-06 |
| 5 | API Management (API proxy, key policy, rate limit) | TODO | e.g. created an API component / gateway | U-09 |
| 6 | Data Hub (optional master data) | TODO | e.g. opened Data Hub, saw a repository | optional |

- [ ] All 6 services checked and recorded as enabled / not enabled

## 4. Team access

| Member | Boomi user (email) | Role in Boomi | Can build + test processes? |
|---|---|---|---|
| Uday | TODO | TODO | TODO |
| Roop | TODO | TODO | TODO (needs Flow + Integration) |
| Nikhil | TODO | TODO | TODO (needs Agentstudio + Integration) |

Add users under Settings > User Management. Each person confirms they can log in and open the services they need.

- [ ] Roop and Nikhil have Boomi platform access

## 5. Fallback decisions (CONTRACTS section 8)

For every service marked "not enabled" in section 3, record the fallback. The contracts (event shape, API, schemas) do not change - only where the step runs.

| Service | Enabled? | Decision | Tasks affected |
|---|---|---|---|
| Event Streams | TODO | TODO - if missing: Boomi process triggered directly by the API Management endpoint | U-08, N-08 |
| Agentstudio / Agent Garden | TODO | TODO - if missing: Django `apps.intelligence.agents` calls the Claude API with the same JSON schemas | N-05, N-06 |
| Flow | TODO | TODO - if missing: approval only in the SaaS Approval Center; Django triggers Boomi execution after the decision | R-06, U-10 |
| API Management | TODO | TODO - if missing: Boomi Web Services Server listener with basic auth | U-09, U-06 |
| Data Hub | TODO | TODO - if missing: skip (optional) | - |

- [ ] Fallback decision recorded for every missing service

If any fallback is chosen, also tell Roop and Nikhil (their tasks change) and add a line to the CONTRACTS changelog only if a contract shape changes (it should not).

## 6. Credentials checklist (values go to `.env`, never here)

| Variable (`.env`) | What | Needed by |
|---|---|---|
| `BOOMI_BASE_URL` | Gateway / listener base URL Django calls | U-06, U-09 |
| `BOOMI_API_KEY` | API Management key (or listener basic-auth user:password if fallback) | U-06, U-09 |
| Boomi platform API user + token | Only if we script deployments via the AtomSphere API | optional |

## 7. Verification log

| Date | Who | What was checked | Result |
|---|---|---|---|
| TODO | Uday | Services + access check | TODO |
