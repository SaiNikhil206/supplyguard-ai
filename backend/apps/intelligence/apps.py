import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class IntelligenceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.intelligence"

    def ready(self):
        from .agents.config import AgentError, backend_name

        try:
            name = backend_name()
        except AgentError as exc:
            logger.error("AGENT_BACKEND is invalid, analysis is disabled: %s", exc)
            return
        if name == "mock":
            logger.warning(
                "AGENT_BACKEND=mock: analysis output is CANNED FIXTURE DATA, not an AI result. "
                "Demo / offline use only - never run real traffic like this."
            )
        elif name == "none":
            logger.info("AGENT_BACKEND not set: cases stay ANALYZING until agents are configured")
