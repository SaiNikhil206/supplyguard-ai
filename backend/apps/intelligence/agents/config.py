"""Agent-runner settings: Django setting first, then environment variable, then default.

Read lazily on every call, so tests can override with `settings` / `monkeypatch.setenv`.
Secrets (ANTHROPIC_API_KEY, BOOMI_API_TOKEN) are read here only and are never logged.
"""

import os
import time
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from django.conf import settings

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKENDS = ("boomi", "claude", "mock")
NONE = "none"  # unset: no agent output at all, the trigger only logs + audits (the stub)


def conf(name: str, default=None):
    value = getattr(settings, name, None)
    if value in (None, ""):
        value = os.environ.get(name)
    return default if value in (None, "") else value


def conf_float(name: str, default: float) -> float:
    try:
        return float(conf(name, default))
    except (TypeError, ValueError):
        return default


def conf_int(name: str, default: int) -> int:
    try:
        return int(conf(name, default))
    except (TypeError, ValueError):
        return default


def conf_bool(name: str, default: bool) -> bool:
    value = conf(name, None)
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def backend_name() -> str:
    """`none` (the default) = analysis is not run; otherwise boomi | claude | mock."""
    name = str(conf("AGENT_BACKEND", NONE)).strip().lower()
    if name not in (*BACKENDS, NONE):
        raise AgentConfigError(
            f"AGENT_BACKEND must be one of {', '.join(BACKENDS)} or {NONE} (got {name!r})"
        )
    return name


_deadline: ContextVar[float | None] = ContextVar("agent_deadline", default=None)


@contextmanager
def deadline(seconds: float):
    """Hard total time budget for everything run inside the block (all agent calls, retries)."""
    token = _deadline.set(time.monotonic() + seconds)
    try:
        yield
    finally:
        _deadline.reset(token)


def remaining(cap: float) -> float:
    """Seconds a single call may still take: `cap`, or what is left of the deadline.
    Raises AgentTimeout when the deadline has passed."""
    end = _deadline.get()
    if end is None:
        return cap
    left = end - time.monotonic()
    if left <= 0:
        raise AgentTimeout("agent run exceeded its total time budget")
    return min(cap, left)


def repo_path(setting: str, *default: str) -> Path:
    configured = conf(setting)
    return Path(configured) if configured else REPO_ROOT.joinpath(*default)


class AgentError(Exception):
    """An agent call failed (transport, auth, timeout). No payload or secret in the message."""


class AgentTimeout(AgentError):
    """The run's total deadline (AGENT_TOTAL_TIMEOUT_SECONDS) passed."""


class AgentConfigError(AgentError):
    """The selected backend is not configured."""


class AgentOutputError(AgentError):
    """The agent answered, but not with a JSON object. `raw` is the text, kept for the AgentRun."""

    def __init__(self, message: str, raw: str = ""):
        super().__init__(message)
        self.raw = raw
