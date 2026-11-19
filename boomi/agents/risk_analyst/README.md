# Supplier Risk Analyst agent (N-05)

Owner: **Nikhil**. Versioned definition of the Agentstudio agent; the same files drive the Claude fallback (N-09).

| File | What |
|---|---|
| `instructions.md` | the prompt (paste into Agentstudio "Instructions"; fallback system prompt) |
| `agent.json` | name, version, model settings, input/output schemas, guardrails and how each is checked |
| `tools.json` | 4 read-only ERP lookups -> Uday's U-07 processes / mock ERP endpoints |
| `eval/adversarial_cases.json` | the 5 adversarial prompts (acceptance) |
| `eval/reference/*.json` | hand-written correct answers for demo and TC-05 (what "good" looks like) |
| `eval/runs/` | real agent outputs, one file per run, graded and kept as evidence |

Input = `ai/schemas/agent_input.schema.json` (build one with `python -m ai.eval.build_agent_input demo`).
Output = `ai/schemas/risk_analysis.schema.json`.

> The `impact` numbers in built inputs are **provisional** until N-04 lands (see `ai/eval/build_agent_input.py`). Affected POs and exposure already match `data/README.md`; delay, coverage (highest-demand location only), shortage (one stock pool per item) and risk_score are placeholders. Note "impact provisional (pre-N-04)" on every run you log in `boomi/TEST_LOG.md`.

## Status (task stays `in-progress`)
| Acceptance | State |
|---|---|
| Prompt, config, tools, guardrails versioned here | done |
| Demo output validates against `risk_analysis.schema.json` | **needs a real agent run** - only the hand-written reference passes today |
| Every claim has evidence pointing to snapshot data | grader enforces it (`claims_backed_by_evidence`); **needs a real run** |
| 5 adversarial prompts -> missing data reported | cases + grader ready; **needs real runs** |

**Not yet created in Agentstudio** - waiting on U-01 (`docs/BOOMI_ENV.md`: is Agentstudio enabled, does Nikhil have access). If Agentstudio is not available, CONTRACTS section 8 fallback applies: N-09 runs these instructions on `claude-sonnet-5-5`.

The grader is a prompt-testing aid. It checks values, ids, dates and wording patterns, not meaning: a sentence can cite the right numbers and still mislead, so every graded run is also read by a person before it counts as evidence.

## Create it in Agentstudio (after U-01)
1. Agentstudio -> new agent "SG Supplier Risk Analyst"; paste `instructions.md` (below the line).
2. Model: account default, lowest temperature available; output format JSON.
3. Tools: add the 4 tools from `tools.json` as Integration tools pointing at Uday's U-07 processes (until those exist, skip tools - the snapshot in the input is enough).
4. Guardrails: enable the items in `agent.json` -> `agentstudio_guardrails_to_enable`.
5. Record the agent id and version in `agent.json` and in `boomi/TEST_LOG.md`.

## Run the acceptance tests against the real agent
For each case (demo, then ADV-01..ADV-05):
```
python -m ai.eval.build_agent_input demo > input.json          # ADV-05 uses tc05_no_alternates
# ADV-02: replace event.description with the case's event_description first
```
1. Send `input.json` as the message (plus the case's `user_message`, if any).
2. Save the agent's JSON reply as `eval/runs/<date>_<case>.json`.
3. Grade it:
```
python -m ai.eval.grade boomi/agents/risk_analyst/eval/runs/<file>.json --scenario demo
python -m ai.eval.grade boomi/agents/risk_analyst/eval/runs/<file>.json --case ADV-01
```
Every line must be `PASS`. Log the result in `boomi/TEST_LOG.md`. A FAIL means: fix the prompt, bump `version` in `agent.json` and the `(vX.Y.Z)` in `instructions.md`, re-run all cases.

## What the grader checks
schema valid · risk_case_id copied · `risk_score` copied from impact · `risk_level` band · every evidence entry resolves to exactly one input value · no unknown ids in `affected_entities` · every affected PO listed · **every number/date in a fact or estimate is the value (or same-field sum) of an evidence entry for a record that sentence names** (due + delay dates allowed only in estimates) · summary numbers/dates exist in the input's numeric/date fields (not UUIDs or tax ids) · assumptions contain no numbers or dates · no spelled-out large numbers · shortage claimed only for POs the impact marks short · every `data_quality_flag` in `missing_data` (verbatim or id + synonym) · not `HIGH` confidence with missing data · per-case forbidden patterns, required `missing_data`, no company names outside the snapshot (ADV-05).

In production the N-07 validator repeats the evidence and fact checks server-side.

## Open items
- **N-07:** evidence from tools (`source: ERP` for a record not in the stored snapshot) must be re-read from the ERP, or tools stay disabled in production. Decide in N-07.
- **S-01:** the evidence addressing (`IMPACT` source, `entity: "IMPACT"` for totals) is part of the N-01 proposal list.
- Tenant-specific risk thresholds (`tenants.settings.risk_thresholds`) currently equal the fixed bands in the prompt; if a tenant changes them, pass them in the input (needs an `agent_input` schema change).
