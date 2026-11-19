# ai/ - Agent contracts

Owner: **Nikhil**. Think of this folder as the data contract for the agent "feed": every agent response is validated here before anything downstream (N-07) persists it.

| Path | What |
|---|---|
| `schemas/risk_analysis.schema.json` | Supplier Risk Analyst output (CONTRACTS section 6) |
| `schemas/recovery_plan.schema.json` | Recovery Planning Agent output (CONTRACTS section 6) |
| `schemas/agent_input.schema.json` | Context sent to either agent: event + ERP snapshot + impact-engine result + data-quality flags (from LLD 16.5; proposed for CONTRACTS section 6) |
| `schemas/common.schema.json` | Shared pieces: IDs, Money, evidence, enums |
| `schema_registry.py` | `validator_for("risk_analysis")` - Draft 2020-12 validator with cross-file `$ref`s resolved (the authoritative check). `bundled_schema(name)` - single-file version with only internal refs, for Claude structured outputs in N-09 |
| `fixtures/valid/` | Demo scenario (SUP-1008 outage) + TC-05 no-option sample. Numbers are illustrative until N-02 fixes the seed |
| `fixtures/invalid/` | Each file = a valid fixture with exactly one defect |
| `fixtures/expected_errors.json` | Invalid case -> the one jsonschema keyword it must fail on |
| `fixtures/generate_fixtures.py` | Regenerates all fixtures (`python ai/fixtures/generate_fixtures.py` from repo root). Edit this, not the JSON |
| `eval/build_agent_input.py` | (N-05) builds a schema-valid `agent_input` from `data/seed` + `data/scenarios` (impact provisional until N-04) |
| `eval/grade.py` | (N-05) grades an agent output against its input: evidence resolves, no unsupported numbers, flags reported, adversarial cases |
| agent definitions | live in `boomi/agents/<agent>/` (instructions, config, tools, eval cases) |

Fixture naming: `<schema>__<case>.json`.

## Rules the schemas enforce
- Every key is required, including `facts`, `estimates`, `assumptions`, `missing_data` (risk) and `assumptions`, `data_gaps` (each option). Empty arrays are fine; omitting the key is not - the agent must state "nothing missing" explicitly.
- `evidence` needs at least one `{source, entity, field, value}` entry; estimates need a `basis`.
- No extra keys (`additionalProperties: false`) - an agent cannot slip in invented fields like `supplier_capacity`.
- Money is `{"amount": "33600.00", "currency": "INR"}` (string decimal).
- Recovery plan: options non-empty and `no_viable_option_reason: null`, or `options: []` and a reason (TC-05).
- Lead time / cost delta may be `null` when the data does not support an estimate; `data_gaps` must then be non-empty.
- `change` must carry the fields its `option_type` needs: ALTERNATE_SUPPLIER -> `supplier_id`; SPLIT_ORDER -> `supplier_id` + `qty`; REVISED_SCHEDULE -> `expected_date`; INVENTORY_TRANSFER -> `item_id`, `from_location_id`, `to_location_id`, `qty`.
- Agent input: `RECOVERY_PLANNER` must carry `risk_analysis`; `RISK_ANALYST` must not.

## Evidence addressing (what N-07 resolves)
Each evidence entry points at ONE value in the agent input - like a (table, primary key, column) lookup:
- `source`: `ERP` (snapshot), `EVENT` (the event), `IMPACT` (impact-engine result).
- `entity`: the record id - `SUP-…`, `PO-…`, `EVT-…`; for inventory, the `item_id`.
- `field`: the snapshot field name exactly (`due_date`, `qty`, `unit_price`, `on_hand`, `capacity`, `lead_time_days`…).
- `item_id` narrows a PO / alternate-supplier record to one line; `location_id` narrows inventory to one row.
- Money is cited by its amount string (`"84.00"`); `value: null` = the record has no value (cite it as missing data).

Not checked here (N-07 does it against the stored snapshot): evidence resolves and values match, IDs/qty/prices exist, ranks unique and contiguous, agent `risk_score` vs `impact.risk_score`.

## Proposed for S-01 (not in CONTRACTS v0.2 yet)
`agent_input.schema.json` as a whole; evidence `source` enum + `item_id`/`location_id` qualifiers + nullable `value`; nullable `estimated_lead_time_days` / `estimated_cost_delta`; `affected_entities.type` enum; `confidence` enum; `change.item_id/from_location_id/to_location_id`; agent money = exactly 2 dp (snapshot money 0-4 dp).

## Run
```
pip install -r ai/requirements.txt
python -m pytest ai/tests -q
```
