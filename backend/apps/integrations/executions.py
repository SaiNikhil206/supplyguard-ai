"""Execution results from Boomi (POST /internal/executions/<id>/result; tasks/UDAY.md U-06).

Rules: tenant-scoped lookup (foreign = missing = same 404, foreign also audited); only
PENDING/RUNNING can become terminal; the identical result again is a no-op 200; a different
terminal result is a 409; response_payload and error are redacted and size-capped before they are
stored. The RiskCase status is NOT touched here: hooks.on_execution_result hands over to the
workflow service (N-10, via transition()).
"""
import json
import logging
import re

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.audit import record
from apps.audit.service import redact
from apps.core.models import Execution

from . import hooks
from .risk_cases import CROSS_TENANT_ACTION, CaseResult, Conflict

logger = logging.getLogger(__name__)

PAYLOAD_MAX_BYTES = 20 * 1024
PREVIEW_CHARS = 16 * 1024
ERROR_MAX_CHARS = 2000
_SECRET_IN_TEXT = re.compile(
    r"(?i)\b(password|passwd|secret|token|api[_-]?key|authorization)\b(\s*[=:]\s*)\S+"
)
_ACTIVE = (Execution.Status.PENDING, Execution.Status.RUNNING)


def sanitize_error(error):
    if error is None:
        return None
    text = redact(str(error))
    text = _SECRET_IN_TEXT.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", text)
    return text[:ERROR_MAX_CHARS]


def sanitize_payload(payload):
    """Redact sensitive keys, then cap the stored size (truncate with a marker, never fail)."""
    if payload is None:
        return None
    clean = redact(payload)
    try:
        text = json.dumps(clean, default=str)
    except (TypeError, ValueError):
        return {"_truncated": True, "reason": "payload could not be serialised"}
    if len(text.encode("utf-8")) <= PAYLOAD_MAX_BYTES:
        return clean
    return {
        "_truncated": True,
        "original_size_bytes": len(text.encode("utf-8")),
        "preview": text[:PREVIEW_CHARS],
    }


def _find_execution(tenant, execution_id) -> Execution:
    execution = Execution.objects.filter(tenant=tenant, id=execution_id).first()
    if execution is not None:
        return execution
    if Execution.objects.filter(id=execution_id).exclude(tenant=tenant).exists():
        record(
            "SYSTEM",
            CROSS_TENANT_ACTION,
            ("Execution", str(execution_id)[:100]),
            tenant=tenant,
            data={"endpoint": "internal.execution-result"},
        )
    raise NotFound()


def _body(execution) -> dict:
    case = execution.approval.risk_case
    case.refresh_from_db(fields=["status"])
    return {
        "execution_id": execution.id,
        "status": execution.status,
        "error_class": execution.error_class,
        "finished_at": execution.finished_at,
        "case_status": case.status,
    }


def apply_execution_result(tenant, execution_id, data, actor="SYSTEM") -> CaseResult:
    new = {
        "status": data["status"],
        "error_class": data.get("error_class") if data["status"] == "FAILED" else None,
        "error": sanitize_error(data.get("error")) if data["status"] == "FAILED" else None,
        "response_status": data.get("response_status"),
        "response_payload": sanitize_payload(data.get("response_payload")),
    }
    # outside the transaction: the cross-tenant audit row must survive the 404
    found = _find_execution(tenant, execution_id)
    with transaction.atomic():
        execution = Execution.objects.select_for_update().get(pk=found.pk)
        if execution.status not in _ACTIVE:
            if all(getattr(execution, k) == v for k, v in new.items()):
                return CaseResult(200, _body(execution))  # same result again: no change
            raise Conflict(f"execution already finished with status {execution.status}")
        now = timezone.now()
        for key, value in new.items():
            setattr(execution, key, value)
        execution.finished_at = now
        if execution.started_at is None:
            execution.started_at = now
        execution.save()
        record(
            actor,
            "execution.result",
            execution,
            correlation_id=execution.approval.risk_case.correlation_id,
            tenant=tenant,
            data={
                "status": execution.status,
                "error_class": execution.error_class,
                "response_status": execution.response_status,
            },
        )
    try:
        hooks.on_execution_result(execution)
    except Exception:  # the result is stored; a workflow failure must not lose the callback
        logger.exception("on_execution_result failed for %s", execution.pk)
    return CaseResult(200, _body(execution))
