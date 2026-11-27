"""The agent instruction texts: the deployed Agentstudio task instructions, reused verbatim as the
Claude system prompt so both backends follow the same rules."""

from functools import lru_cache

from .config import repo_path

_FILES = {
    "RISK_ANALYST": ("risk_analyst", "agentstudio_task_instructions.txt"),
    "RECOVERY_PLANNER": ("recovery_planner", "agentstudio_task_instructions.txt"),
}


@lru_cache(maxsize=8)
def _read(folder: str, name: str, root: str) -> str:
    return (repo_path("AGENT_INSTRUCTIONS_DIR", "boomi", "agents") / folder / name).read_text(
        encoding="utf-8"
    )


def system_prompt(agent: str) -> str:
    folder, name = _FILES[agent]
    root = str(repo_path("AGENT_INSTRUCTIONS_DIR", "boomi", "agents"))
    return _read(folder, name, root)
