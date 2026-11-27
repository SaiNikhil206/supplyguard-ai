# boomi/processes/correlation/ - N-08 correlation process (Nikhil)

Task N-08: Boomi process `SG_Disruption_Correlate`. Event (from U-08 subscriber) -> 4 ERP reads (Uday's U-07 processes) -> assemble the ERP snapshot -> `POST /api/v1/internal/risk-cases` -> done. Django then creates the case, computes impact and runs the agents.

**Status 2026-11-27: spec written, nothing built in Boomi.** Blocked on the U-07 build (the four `SG_Get_*` processes must be deployed) and on the U-08 hand-off decision.

| File | What |
|---|---|
| `SG_Disruption_Correlate.BUILD_SPEC.md` | the full build spec: shapes, snapshot mapping, Django responses, agents decision, errors, timing, extensions, test plan |
| `export/` | (after building) exported component XML |

## Decisions (details in the spec)
- **Agents:** Django runs them (`AGENT_BACKEND=boomi|claude|mock`, N-09); Boomi only creates the case. Needs one small N-09 change: fire the AnalysisTrigger on case creation too.
- **Entry:** Data Passthrough start, Process Call from `SG_Subscribe_Disruption` (U-08 option A, same account/runtime), plus a listener wrapper `SG_Disruption_Correlate_Entry` for tests and the Direct fallback.
- **ERP reads:** HTTP Client calls to the U-07 listeners; inventory and alternates once per distinct item. U-07 errors come back as an `error` key with HTTP 200.
- **Timing:** N-08 itself ~2 s (demo), ~4-5 s (TC-03). The 5 s simulate path depends on the Event Streams hop (2-3 s measured); fallback is `SG_Disruption_Direct`.

## Open questions
1. Uday: real listener URLs + a Basic credential for Boomi-to-Boomi calls; are Data Passthrough variants of the `SG_Get_*` processes possible? Optional batch reads by `item_ids[]`?
2. Uday + Nikhil: U-08 hand-off (option A import into Uday's account vs B HTTPS) and connection-slot budget for two more HTTP connections.
3. N-09 / Uday: fire the AnalysisTrigger when a case is created (edit in Uday's `integrations/risk_cases.py` or in `workflow.transition()`).
4. U-11: name of the dead-letter process and its input.
5. SYSTEM API key per tenant: one key in the extension = one tenant.
