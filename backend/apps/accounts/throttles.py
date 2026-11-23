import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginUsernameThrottle(SimpleRateThrottle):
    """Limits /auth/token per (lowercased) username on top of the per-IP limit, so rotating
    IPs cannot guess one account's password without limit. Trade-off: anyone can lock a known
    username out of logging in for the rest of the minute by sending bad attempts."""

    scope = "auth_username"

    def get_cache_key(self, request, view):
        data = request.data
        username = data.get("username") if hasattr(data, "get") else None
        if not isinstance(username, str) or not username.strip():
            return None  # nothing to key on; the per-IP throttle still applies
        ident = hashlib.sha256(username.strip().lower()[:150].encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}
