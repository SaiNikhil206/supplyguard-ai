# Boomi environment (U-01)

**Owner:** Uday. **Status:** platform facts filled in on 2026-11-19 by Claude, **read-only**, through the browser pane signed in as Uday. Nothing was created, changed or run in Boomi. Items marked **OPEN** need Uday (account actions or decisions); they are why U-01 is still `blocked`.

This file is the single source of truth for "what Boomi do we actually have". Every later Boomi task (U-07..U-11, N-05/N-06/N-08, R-06, R-12) reads it. Never put passwords, API tokens or shared secrets here - only names, IDs and yes/no facts. Credentials go into each member's `.env` (gitignored).

**Headline (read this first):**
1. **Flow is NOT available** in this account -> R-06 / the Flow approval screens need the CONTRACTS section 8 fallback (see section 5). **OPEN: confirm.**
2. **Each member works in their own Boomi training account.** This file describes **Uday's** account only. Roop and Nikhil do not need an invite; they record their own account in section 9. Consequence: Boomi components are not shared automatically between accounts (section 9).
3. The only runtime is a **local runtime on Uday's own PC (`ESI-PC28`)**, attached to the only environment, which belongs to the BIMBA project. It can reach `localhost` on that PC, so no tunnel is needed for Uday's own S1 testing.
4. **Account expiry is not shown anywhere readable** (Account Information and Licensing pages). It is a `Training-` account. **OPEN: confirm it outlives 31 Dec 2026.**
5. Integration, Event Streams, Agentstudio, API Management and Data Hub are **accessible**, but nothing was created or run in them yet (see section 3).

---

## 1. Account

| Item | Value |
|---|---|
| Account name | `Training-Visinigiri-UdayKiran` |
| Account ID (Settings > Account Information) | `trainingvisinigiriudaykir-VL9DS4` |
| Account type and expiry date | Training account, Environment Type **Unlimited**. **Expiry: not shown** on Account Information or Licensing - **OPEN**, must be after 31 Dec 2026 (ask Boomi training admin / support) |
| Platform region / base URL | `https://platform.boomi.com` (US; Event Streams environment is in USA East) |
| Account admin (who can add users / enable services) | Uday - the only user, and the Account Information page is editable for him |
| Shared with another project? | **Yes** - the account already holds the BIMBA project (connectors, processes, JSON profiles, an OPC UA environment). Do not edit those components. |

## 2. Environments and runtime

| Item | Value |
|---|---|
| Environments - name + classification | One: `BIMBA-OPCUA-Test` (classification **Test**, 1 runtime). It belongs to BIMBA, not SupplyGuard. No SupplyGuard environment exists yet. |
| Runtime type | **Basic Runtime = local runtime** (not a cloud runtime) |
| Runtime name + attached environment | `ESI-PC28.easystepin.com` in `BIMBA-OPCUA-Test`. Status **Online**, version 26.11.4, installed 18 Nov 2026. |
| Whose machine? | **Uday's own PC** - `hostname` here is `ESI-PC28`, identical to the runtime host. The runtime is only online while that PC is on. |
| Runtime can reach the public internet over HTTPS (U-12) | **Not verified** (a local runtime normally can; test with an HTTP Client call during U-07) |
| Can we add environment extensions (connection URL, credentials)? | **Not verified.** Advanced Runtime and Environment Extension Access is OFF, so no extra restriction applies; confirm when U-07 sets the first extension. |

What this means:
- A local runtime sits on `ESI-PC28`, so Boomi **can** call `localhost` services on this PC (backend on `8000/8001`, mock ERP) with no tunnel. That helps Uday's S1 work.
- It does **not** help Roop's or Nikhil's machines, and the demo still needs hosted URLs (U-12, S4).
- Calls the other way (Django -> Boomi listener) must reach this PC, e.g. from Docker via `host.docker.internal`, or over the office network for teammates.
- A basic runtime attaches to **one** environment. **OPEN decision:** reuse `BIMBA-OPCUA-Test` for SupplyGuard (simplest, shares with BIMBA), or create `SG-Dev` and install a second runtime (isolated, more setup, and it consumes connection slots, see section 8).

## 3. Services

"Access-verified" = the service opens for this account and the matching roles exist. "Build-verified" = we created and ran something. **Only access was verified; no service is build-verified yet** - each service's first build task (U-07, U-08, U-09, N-05) confirms it.

| # | Service | Enabled? | How verified | Used by |
|---|---|---|---|---|
| 1 | Integration (processes, connectors, maps) | **Yes** (access) | Build and Runtime Management open; account already contains BIMBA processes and connectors | U-07, U-08, U-10, U-11, N-08 |
| 2 | Event Streams (topics, publish/subscribe) | **Yes** (access) | `EventStreams.html` opens and lists environment `BIMBA-OPCUA-Test` (USA East); roles "Event Streams - Administrator / Access" exist. No topic created. | U-08 |
| 3 | Agentstudio / Agent Garden (AI agents) | **Yes** (access) | Agentstudio home opens; roles "Agent Garden - Administrator / Developer / User" exist. No agent created. | N-05, N-06 |
| 4 | Flow (human approval UI) | **NO** | `flow.boomi.com` says "You are not a user in any tenants"; no Flow tile on Home, no Flow role in Account Information | R-06 |
| 5 | API Management (API proxy, key policy, rate limit) | **Yes** (access) | `ApiSphere.html` opens; roles for API Manager / Administrator exist; API Lifecycle feature ON; "Cloud API Management" under Manage. No API created. | U-09 |
| 6 | Data Hub (optional master data) | **Yes** (access), optional | `MdmSphere.html` ("Boomi Hub") opens; MDM roles exist. No repository checked. | optional |

Other tiles on Home (not used by SupplyGuard): Data Integration, Connect, Metahub, Publisher.

- [x] All 6 services checked and recorded as enabled / not enabled (access level only - see note above)

## 4. Team access

| Member | Boomi account | Role | Can build + test processes? |
|---|---|---|---|
| Uday | This account (`trainingvisinigiriudaykir-VL9DS4`), the only user in it | Administrator | Yes |
| Roop | **His own training account** (per Uday; not checked by Claude) | his own | Per Roop - fill section 9 |
| Nikhil | **His own training account** (per Uday; not checked by Claude) | his own | Per Nikhil - fill section 9 |

No invitations to Uday's account are needed. The criterion is read as "each member has Boomi platform access" and is ticked on Uday's word. Roop and Nikhil should each confirm which services their account has (section 9).

- [x] Roop and Nikhil have Boomi platform access (own accounts, per Uday - services in their accounts not yet recorded)

## 5. Fallback decisions (CONTRACTS section 8)

Contracts (event shape, API, schemas) do not change - only where a step runs.

| Service | Enabled? | Decision | Tasks affected |
|---|---|---|---|
| Event Streams | Yes (access) | None needed. Re-check when U-08 creates the first topic. | U-08, N-08 |
| Agentstudio / Agent Garden | Yes (access) | None needed. Re-check when N-05 creates the first agent. | N-05, N-06 |
| **Flow** | **No, in Uday's account.** Unknown in Roop's own account. | **OPEN - Roop checks `flow.boomi.com` in his own account first.** If his account has Flow, no fallback is needed: he builds R-06 there. If no account has Flow, use the fallback: approval only in the SaaS Approval Center, Django triggers the Boomi execution process after the decision, and the Boomi Flow screens leave R-06/R-12 scope. | R-06, U-10, Roop's Flow work (`boomi/flow/`) |
| API Management | Yes (access) | None needed. Re-check when U-09 creates the first API. | U-09, U-06 |
| Data Hub | Yes (access) | n/a (optional) | - |

- [ ] Fallback decision recorded for every missing service (Flow proposed above, not yet confirmed)

If the Flow fallback is confirmed, tell Roop and Nikhil (their tasks change). No contract shape changes, so no CONTRACTS changelog line is needed.

## 6. Credentials checklist (values go to `.env`, never here)

| Variable (`.env`) | What | Needed by |
|---|---|---|
| `BOOMI_BASE_URL` | Gateway / listener base URL Django calls | U-06, U-09 |
| `BOOMI_API_KEY` | API Management key (or listener basic-auth user:password if fallback) | U-06, U-09 |
| Boomi platform API user + token | Only if we script deployments via the AtomSphere API | optional |

## 7. Verification log

| Date | Who | What was checked | Result |
|---|---|---|---|
| 2026-11-19 | Claude (read-only, signed in as Uday) | Home service list; Runtime Management; Settings > Account Information, Licensing, Features, User Management; open each service page; `flow.boomi.com` | Section 1-4 above. Not checked: expiry date, internet reachability, extensions. Nothing created or changed. |

## 8. Constraints found (affect later tasks)

- **Connection licences are small:** 3 Standard (production) and 3 Standard (Test) available; the BIMBA SNMP connector already uses 1 Test slot (2 left). Budget the SupplyGuard connections (mock ERP HTTP Client, Event Streams, listeners) before U-07 and avoid duplicating the same connection per process.
- **Component Locking is OFF and Branching is OFF:** two people editing the same Boomi process can overwrite each other. Agree one editor per process (follows the folder ownership in CLAUDE.md) and keep the `boomi/` exports in git as the backup.
- **Shared account:** keep SupplyGuard components in their own folder (e.g. `SupplyGuard`) away from the BIMBA folders, and prefix names `SG_`.
- **Uday's PC is the runtime:** if `ESI-PC28` is off or asleep, every Boomi test run fails. Keep it awake during demos and sprint-end checks.

## 9. Other team accounts (Roop, Nikhil)

Each member builds in their own training account, so these facts are per account. Roop and Nikhil: copy the table, fill it in from your own account, and commit it here (names/IDs/yes-no only, no secrets).

| Item | Roop | Nikhil |
|---|---|---|
| Account ID | TODO | TODO |
| Account expiry (must be after 31 Dec 2026) | TODO | TODO |
| Runtime (type, host, online?) | TODO | TODO |
| Integration / Event Streams / Agentstudio / Flow / API Management / Data Hub available? | TODO (**Flow is the one that matters**) | TODO (**Agentstudio is the one that matters**) |

**Consequence of separate accounts - OPEN, decide before U-07/N-08:** Boomi processes cannot call processes in another account, and Event Streams topics, API Management gateways and runtimes are per account. The design in the task files assumes one shared account in places:
- **N-08** (Nikhil's correlation process) "reads via Uday's ERP processes" `SG_Get_*` (U-07), and **N-05/N-06** agents use those processes as tools.
- **U-08** topics and the U-09 gateway live in Uday's account.

Options: (a) Nikhil imports Uday's `boomi/processes/` exports into his account and runs them on his runtime against the mock ERP (needs the mock ERP reachable from his runtime); (b) the accounts talk over HTTPS only (Uday's API Management endpoints, Django API) and each side keeps its own process set; (c) one member builds the whole Boomi chain in one account. Exports under `boomi/` in git are the hand-off format in every option.
