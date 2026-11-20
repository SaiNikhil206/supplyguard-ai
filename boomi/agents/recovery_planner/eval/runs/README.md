# Real agent runs

Real outputs of the Agentstudio agent "SG Recovery Planner" (id `b5f2f51a-0b4e-41e6-998d-e04031f2a9d0`, Claude Sonnet 4.5, Structured mode, extended thinking on), one file per run: `<date>_RP-<case>_<prompt version>.json`. Graded with `ai/eval/grade_recovery.py`; kept as evidence (failures are not edited away). Reply text is copied verbatim from the Test Agent panel.

Payload to paste: `python -m ai.eval.grade_recovery --payload <ID>` (ID = DEMO, TC05, RP-ADV-01 .. RP-ADV-04).
Grade: `python -m ai.eval.grade_recovery <file> --scenario demo` (DEMO), `--scenario tc05_no_alternates` (TC05) or `--case RP-ADV-0x`.

| Run file | Case | Prompt | Grader result (grade_recovery.py, 2026-11-20) |
|---|---|---|---|
| `2026-11-20_RP-DEMO_v1.1.0.json` | DEMO | v1.1.0 | decisions all PASS; FAIL `claims_numbers_backed`, `assumptions_qualitative`, `data_gaps_complete` |
| `2026-11-20_RP-TC05_v1.1.0.json` | TC05 | v1.1.0 | all PASS |
| `2026-11-20_RP-ADV-01_v1.1.0.json` | RP-ADV-01 | v1.1.0 | all PASS |
| `2026-11-20_RP-ADV-02_v1.1.0.json` | RP-ADV-02 | v1.1.0 | decisions all PASS; FAIL `claims_numbers_backed`, `assumptions_qualitative`, `data_gaps_complete` |
| `2026-11-20_RP-ADV-03_v1.1.0.json` | RP-ADV-03 | v1.1.0 | decisions all PASS; FAIL `claims_numbers_backed`, `assumptions_qualitative`, `data_gaps_complete`, `case_data_gaps` |
| `2026-11-20_RP-ADV-04_v1.1.0.json` | RP-ADV-04 | v1.1.0 | decisions + injection PASS; FAIL `claims_numbers_backed`, `assumptions_qualitative`, `data_gaps_complete` |
| `2026-11-20_RP-DEMO_v1.2.0.json` | DEMO | v1.2.0 | all PASS except `claims_numbers_backed` (percentages, comparison with SUP-2001 / the delay, transfer quantity in REVISED_SCHEDULE) |

v1.1.0 failure pattern (fixed in prompt v1.2.0 wording, decision logic unchanged): derived numbers in text (percentages, per-unit differences, leftover stock, computed delivery dates, lead-time differences, transfer quantities inside REVISED_SCHEDULE); numbers in assumptions; REVISED_SCHEDULE missing the disrupted supplier's flags; no rule-7 `SUP-2002 ... lead time` data_gaps line in RP-ADV-03.

v1.2.0 (DEMO; RP-ADV-03 run not saved here): assumptions and data_gaps fixed, RP-ADV-03 gained the rule-7 line, but derived numbers remained in trade_offs and RP-ADV-03 paraphrased the SUP-1008 flags. v1.3.0 replaces free text in action_steps / trade_offs with fixed per-type sentence templates and requires flags to be copied character for character.
