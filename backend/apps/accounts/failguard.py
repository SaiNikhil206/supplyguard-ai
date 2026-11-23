"""Per-client-IP counters that keep failed-credential attempts from flooding the audit table
or being tried without limit. Counters live in the Django cache (per process, like the login
throttle: each gunicorn worker counts separately). The client IP is DRF's `get_ident`, which
honours `NUM_PROXIES`, so a spoofed X-Forwarded-For does not mint a new bucket."""
import logging

from django.conf import settings
from django.core.cache import cache
from rest_framework.throttling import BaseThrottle

logger = logging.getLogger(__name__)
WINDOW = 60  # seconds


def client_ip(request) -> str:
    return BaseThrottle().get_ident(request)


def _bump(name: str, ip: str) -> int:
    key = f"failguard:{name}:{ip}"
    cache.add(key, 0, WINDOW)
    try:
        return cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.set(key, 1, WINDOW)
        return 1


def _count(name: str, ip: str) -> int:
    return cache.get(f"failguard:{name}:{ip}", 0)


def should_audit_failure(request, what: str) -> bool:
    """True while this IP is under AUTH_FAIL_AUDIT_PER_MIN audit rows this minute. The first
    skipped write logs one warning (no credentials) with the request's correlation id."""
    limit = settings.AUTH_FAIL_AUDIT_PER_MIN
    count = _bump("audit", client_ip(request))
    if count <= limit:
        return True
    if count == limit + 1:
        logger.warning(
            "audit rows for failed credentials are rate limited (%s per minute per IP); "
            "skipping further '%s' rows",
            limit,
            what,
        )
    return False


def api_key_failures(request) -> int:
    return _count("apikey", client_ip(request))


def record_api_key_failure(request) -> int:
    return _bump("apikey", client_ip(request))
