"""Print the exact JSON to paste into the Agentstudio "Test Agent" panel (Structured mode) for one eval run.

    python -m ai.eval.payload DEMO       # demo scenario
    python -m ai.eval.payload ADV-01     # adversarial case: event override applied, user_message added

Structured mode takes one JSON payload, so an adversarial case's chat request travels as a top-level
`user_message` field (eval only - not part of agent_input.schema.json; production calls never send it).
"""

from __future__ import annotations

import json
import sys

from ai.eval.build_agent_input import build_agent_input
from ai.eval.grade import case_input, load_cases


def payload(run_id: str) -> dict:
    if run_id.upper() == "DEMO":
        return build_agent_input("demo")
    case = next(c for c in load_cases() if c["id"] == run_id.upper())
    p = case_input(case)
    if case.get("user_message"):
        p["user_message"] = case["user_message"]
    return p


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(json.dumps(payload(sys.argv[1]), separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
