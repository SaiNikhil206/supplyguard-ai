from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    """Liveness + DB readiness probe. Unauthenticated, no tenant data."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db = "ok"
    except Exception:  # noqa: BLE001 - any DB failure means "not ready"
        db = "unavailable"
    status = "ok" if db == "ok" else "degraded"
    return JsonResponse({"status": status, "db": db}, status=200 if db == "ok" else 503)
