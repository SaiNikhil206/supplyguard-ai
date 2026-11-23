"""Logging filter that stamps every record with the current correlation id (`-` if none)."""
import logging

from .context import get_correlation_id


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"
        return True
