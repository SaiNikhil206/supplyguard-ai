"""`boomi` backend: the deployed Agentstudio agents through the Agent Garden Execute API.

POST {AGENTSTUDIO_EXECUTE_URL}/execute/api/v1/{BOOMI_ACCOUNT_ID}/session
     body {"message": <agent_input object>, "deployment_id": <deployment>}
     reply {"success", "agent_id", "session_id", "data": <agent output object>}
HTTP Basic `BOOMI_TOKEN.<BOOMI_USERNAME>:<BOOMI_API_TOKEN>`. Everything comes from settings / env;
without it AgentConfigError is raised. Nothing secret or any payload is logged or put in an error.
(N-08 owns the in-Boomi call; this is the Django-side client for the same deployed agents.)
"""

import json
import logging

import httpx

from .config import AgentConfigError, AgentError, AgentOutputError, conf, conf_float
from .payload import RECOVERY_PLANNER, RISK_ANALYST, build_agent_input

logger = logging.getLogger(__name__)

_DEPLOYMENT_SETTING = {
    RISK_ANALYST: "AGENTSTUDIO_RISK_ANALYST_DEPLOYMENT_ID",
    RECOVERY_PLANNER: "AGENTSTUDIO_RECOVERY_PLANNER_DEPLOYMENT_ID",
}
_REQUIRED = ("AGENTSTUDIO_EXECUTE_URL", "BOOMI_ACCOUNT_ID", "BOOMI_USERNAME", "BOOMI_API_TOKEN")


def _transport():  # tests replace this with httpx.MockTransport
    return None


def _config(agent: str) -> tuple[str, tuple[str, str], str]:
    missing = [n for n in (*_REQUIRED, _DEPLOYMENT_SETTING[agent]) if not conf(n)]
    if missing:
        raise AgentConfigError(
            "AGENT_BACKEND=boomi is not configured; missing: " + ", ".join(missing)
        )
    host = str(conf("AGENTSTUDIO_EXECUTE_URL")).rstrip("/")
    url = f"{host}/execute/api/v1/{conf('BOOMI_ACCOUNT_ID')}/session"
    auth = (f"BOOMI_TOKEN.{conf('BOOMI_USERNAME')}", str(conf("BOOMI_API_TOKEN")))
    return url, auth, str(conf(_DEPLOYMENT_SETTING[agent]))


def _call(agent: str, case, risk_analysis, feedback: str) -> dict:
    url, auth, deployment = _config(agent)
    message = build_agent_input(case, agent, risk_analysis)
    if feedback:
        message["user_message"] = feedback
    try:
        with httpx.Client(
            timeout=conf_float("AGENTSTUDIO_SESSION_TIMEOUT", 120.0), transport=_transport()
        ) as client:
            response = client.post(
                url, auth=auth, json={"message": message, "deployment_id": deployment}
            )
    except httpx.TimeoutException:
        raise AgentError("Agentstudio call timed out") from None
    except httpx.HTTPError as exc:
        raise AgentError(f"Agentstudio call failed ({type(exc).__name__})") from None
    if response.status_code >= 400:
        raise AgentError(f"Agentstudio call failed with HTTP {response.status_code}")
    try:
        body = response.json()
    except ValueError:
        raise AgentOutputError("Agentstudio reply is not JSON", response.text[:20000]) from None
    data = body.get("data") if isinstance(body, dict) else None
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except ValueError:
            raise AgentOutputError("Agent output is not valid JSON", data[:20000]) from None
    if not isinstance(data, dict):
        raise AgentOutputError("Agentstudio reply has no agent output object", "")
    return data


def run_risk_analyst(case, *, feedback: str = "") -> dict:
    return _call(RISK_ANALYST, case, None, feedback)


def run_recovery_planner(case, risk_analysis, *, feedback: str = "") -> dict:
    return _call(RECOVERY_PLANNER, case, risk_analysis, feedback)
