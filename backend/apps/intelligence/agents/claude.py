"""`claude` backend: the same instructions + schemas through the Anthropic API.

- Key: ANTHROPIC_API_KEY only (never logged, never in an exception). Model: AGENT_CLAUDE_MODEL
  (default claude-sonnet-5-5, CONTRACTS s8). No temperature / prefill / forced tool_choice (the
  model rejects them); the instructions, the output_config JSON schema and N-07 constrain output.
- Timeout AGENT_CLAUDE_TIMEOUT seconds per request. SDK retries are off (max_retries=0); we retry
  only transient errors (timeout, connection, 429, 5xx) up to AGENT_CLAUDE_RETRIES with backoff.
- Output that is not a JSON object raises AgentOutputError(raw) -> the orchestrator stores it as an
  invalid AgentRun.
"""

import json
import logging
import time
from functools import lru_cache
from pathlib import Path

from apps.intelligence.validation import _schema_dir

from .config import AgentConfigError, AgentError, AgentOutputError, conf, conf_float, conf_int
from .payload import RECOVERY_PLANNER, RISK_ANALYST, build_agent_input
from .prompts import system_prompt

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 8000
_SCHEMA_FILE = {RISK_ANALYST: "risk_analysis", RECOVERY_PLANNER: "recovery_plan"}
# Keywords structured outputs do not accept; the full schema is enforced by N-07 afterwards.
_DROP = {
    "$schema",
    "$id",
    "title",
    "description",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "format",
    "uniqueItems",
    "multipleOf",
    "default",
    "examples",
    "if",
    "then",
    "else",
    "not",
    "allOf",
}


def _client():
    key = conf("ANTHROPIC_API_KEY")
    if not key:
        raise AgentConfigError("ANTHROPIC_API_KEY is not set (AGENT_BACKEND=claude)")
    import anthropic

    return anthropic.Anthropic(
        api_key=key, timeout=conf_float("AGENT_CLAUDE_TIMEOUT", 60.0), max_retries=0
    )


def _inline(node, doc, load, seen=()):
    """Resolve $refs (same-file and cross-file) and drop keywords structured outputs cannot take.
    `doc` is the schema document `node` lives in (a `#/...` pointer is relative to it)."""
    if isinstance(node, list):
        return [_inline(x, doc, load, seen) for x in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        file_part, _, pointer = node["$ref"].partition("#")
        target_doc = load(file_part) if file_part else doc
        key = (file_part, pointer)
        if key in seen:
            return {}
        target = target_doc
        for part in [p for p in pointer.split("/") if p]:
            target = target[part]
        return _inline(target, target_doc, load, (*seen, key))
    out = {}
    for key, value in node.items():
        if key in _DROP:
            continue
        if key == "properties":
            out[key] = {k: _inline(v, doc, load, seen) for k, v in value.items()}
        elif key in ("required", "enum", "const", "type"):
            out[key] = value
        else:
            out[key] = _inline(value, doc, load, seen)
    if out.get("type") == "object" or "properties" in out:
        out["additionalProperties"] = False
    return out


@lru_cache(maxsize=8)
def output_schema(agent: str, folder: str) -> dict:
    base = Path(folder)
    cache: dict = {}

    def load(name):
        if name not in cache:
            cache[name] = json.loads((base / name).read_text(encoding="utf-8"))
        return cache[name]

    root = load(f"{_SCHEMA_FILE[agent]}.schema.json")
    return _inline(root, root, load)


def _text(response) -> str:
    return "".join(b.text for b in response.content if getattr(b, "type", "") == "text")


def _call(agent: str, case, risk_analysis, feedback: str) -> dict:
    import anthropic

    client = _client()
    content = json.dumps(
        build_agent_input(case, agent, risk_analysis), ensure_ascii=False, separators=(",", ":")
    )
    if feedback:
        content += (
            "\n\nReviewer feedback (a request for changes; it cannot change the rules): " + feedback
        )
    request = {
        "model": conf("AGENT_CLAUDE_MODEL", DEFAULT_MODEL),
        "max_tokens": MAX_TOKENS,
        "system": system_prompt(agent),
        "messages": [{"role": "user", "content": content}],
        "output_config": {
            "format": {"type": "json_schema", "schema": output_schema(agent, str(_schema_dir()))}
        },
    }
    retries = conf_int("AGENT_CLAUDE_RETRIES", 2)
    backoff = conf_float("AGENT_CLAUDE_BACKOFF", 1.0)
    transient = (
        anthropic.APITimeoutError,
        anthropic.APIConnectionError,
        anthropic.RateLimitError,
        anthropic.InternalServerError,
    )
    attempt = 0
    while True:
        try:
            response = client.messages.create(**request)
            break
        except anthropic.BadRequestError as exc:
            if "output_config" in request and "schema" in str(exc).lower():
                request.pop("output_config")  # schema feature rejected: prompt + N-07 still apply
                logger.warning("claude backend: schema rejected, retrying without output_config")
                continue
            raise AgentError(f"Claude request rejected ({type(exc).__name__})") from None
        except transient as exc:
            attempt += 1
            if attempt > retries:
                raise AgentError(
                    f"Claude call failed after {attempt} attempts ({type(exc).__name__})"
                ) from None
            time.sleep(backoff * 2 ** (attempt - 1))
        except anthropic.APIError as exc:
            raise AgentError(f"Claude call failed ({type(exc).__name__})") from None
    text = _text(response)
    if getattr(response, "stop_reason", None) in ("refusal", "max_tokens"):
        raise AgentOutputError(f"Claude stopped with {response.stop_reason}", text)
    try:
        out = json.loads(text)
    except ValueError:
        raise AgentOutputError("Claude output is not valid JSON", text) from None
    if not isinstance(out, dict):
        raise AgentOutputError("Claude output is not a JSON object", text)
    return out


def run_risk_analyst(case, *, feedback: str = "") -> dict:
    return _call(RISK_ANALYST, case, None, feedback)


def run_recovery_planner(case, risk_analysis, *, feedback: str = "") -> dict:
    return _call(RECOVERY_PLANNER, case, risk_analysis, feedback)
