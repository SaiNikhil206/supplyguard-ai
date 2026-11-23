"""POST /api/v1/internal/executions/<id>/result (U-06 piece 2)."""
import json
from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.core.models import Execution
from apps.integrations import executions, hooks
from tests.factories import make_execution, make_tenant, make_user
from tests.helpers import api_key_client, jwt_client, strip_cid

pytestmark = pytest.mark.django_db
VERIFIED_OK = {"status": "SUCCEEDED", "verified": True, "response_status": 200}
FAILED = {"status": "FAILED", "error_class": "TRANSIENT", "error": "ERP timeout"}


def url(execution_id):
    return f"/api/v1/internal/executions/{execution_id}/result"


@pytest.fixture
def acme():
    return make_tenant("TEN-ACME")


@pytest.fixture
def key(acme):
    return api_key_client(acme)


@pytest.fixture
def execution(acme):
    return make_execution(acme)


@pytest.fixture(autouse=True)
def hook(monkeypatch):
    spy = mock.MagicMock()
    monkeypatch.setattr(hooks, "on_execution_result", spy)
    return spy


def send(client, execution_id, body):
    return client.post(url(execution_id), body, format="json")


# --- success / failure rules -------------------------------------------------------------------
def test_succeeded_requires_verified_true(key, execution):
    for body in (
        {"status": "SUCCEEDED"},
        {"status": "SUCCEEDED", "verified": False},
        {"status": "SUCCEEDED", "response_status": 200},
    ):
        response = send(key, execution.id, body)
        assert response.status_code == 400, body
    execution.refresh_from_db()
    assert execution.status == "PENDING" and execution.finished_at is None


def test_verified_success_is_stored(key, execution, hook):
    case_status = execution.approval.risk_case.status
    response = send(
        key,
        execution.id,
        {**VERIFIED_OK, "response_payload": {"po_id": "PO-1001", "new_due_date": "2026-12-09"}},
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["execution_id"] == execution.id and body["status"] == "SUCCEEDED"
    assert body["error_class"] is None and body["finished_at"]
    assert body["case_status"] == case_status  # this callback never moves the case
    execution.refresh_from_db()
    assert execution.status == "SUCCEEDED" and execution.response_status == 200
    assert execution.finished_at is not None and execution.started_at is not None
    assert execution.response_payload == {"po_id": "PO-1001", "new_due_date": "2026-12-09"}
    assert execution.error is None and execution.error_class is None
    execution.approval.risk_case.refresh_from_db()
    assert execution.approval.risk_case.status == case_status
    hook.assert_called_once()
    assert hook.call_args.args[0].pk == execution.pk

    (row,) = AuditEvent.objects.filter(action="execution.result")
    assert row.actor == "SYSTEM" and row.tenant_id == "TEN-ACME"
    assert (row.entity_type, row.entity_id) == ("Execution", execution.id)
    assert row.data == {"status": "SUCCEEDED", "error_class": None, "response_status": 200}


def test_response_payload_and_error_are_redacted(key, execution):
    payload = {
        "api_key": "sgk_live_abcdef",
        "nested": {"password": "hunter2", "Authorization": "Bearer abc.def", "ok": 1},
        "list": [{"token": "t0k3n"}],
        "po_id": "PO-1",
    }
    response = send(key, execution.id, {**VERIFIED_OK, "response_payload": payload})
    assert response.status_code == 200
    stored = Execution.objects.get(pk=execution.pk).response_payload
    assert stored["api_key"] == "[REDACTED]"
    assert stored["nested"] == {"password": "[REDACTED]", "Authorization": "[REDACTED]", "ok": 1}
    assert stored["list"] == [{"token": "[REDACTED]"}]
    assert stored["po_id"] == "PO-1"
    assert "hunter2" not in json.dumps(stored)


def test_error_text_is_sanitised_and_capped(key, execution):
    err = "upstream said password=hunter2 and token: abc123 " + "x" * 1900
    response = send(key, execution.id, {**FAILED, "error": err})
    assert response.status_code == 200
    stored = Execution.objects.get(pk=execution.pk).error
    assert "hunter2" not in stored and "abc123" not in stored
    assert len(stored) <= 2000


def test_error_longer_than_2000_is_400(key, execution):
    assert send(key, execution.id, {**FAILED, "error": "x" * 2001}).status_code == 400


def test_failed_needs_error_class_and_error(key, execution):
    assert send(key, execution.id, {"status": "FAILED", "error": "boom"}).status_code == 400
    assert send(key, execution.id, {"status": "FAILED", "error_class": "AUTH"}).status_code == 400
    assert (
        send(key, execution.id, {"status": "FAILED", "error_class": "NOPE", "error": "x"}
             ).status_code == 400
    )
    assert Execution.objects.get(pk=execution.pk).status == "PENDING"


def test_failed_result_is_stored(key, execution, hook):
    response = send(key, execution.id, {**FAILED, "response_status": 504})
    assert response.status_code == 200
    assert response.json()["status"] == "FAILED" and response.json()["error_class"] == "TRANSIENT"
    execution.refresh_from_db()
    assert (execution.status, execution.error_class, execution.error) == (
        "FAILED", "TRANSIENT", "ERP timeout",
    )
    assert execution.response_status == 504 and execution.retryable
    hook.assert_called_once()


def test_running_execution_can_finish(key, acme):
    running = make_execution(acme, status="RUNNING")
    assert send(key, running.id, VERIFIED_OK).status_code == 200


@pytest.mark.parametrize("status", [99, 600, "x"])
def test_response_status_range(key, execution, status):
    assert send(key, execution.id, {**VERIFIED_OK, "response_status": status}).status_code == 400


def test_non_terminal_status_is_400(key, execution):
    assert send(key, execution.id, {"status": "RUNNING"}).status_code == 400


def test_payload_must_be_an_object(key, execution):
    assert send(key, execution.id, {**VERIFIED_OK, "response_payload": [1]}).status_code == 400


# --- idempotency / conflict --------------------------------------------------------------------
def test_identical_repeat_is_200_without_change(key, execution, hook):
    first = send(key, execution.id, VERIFIED_OK)
    stamp = Execution.objects.get(pk=execution.pk).finished_at
    second = send(key, execution.id, VERIFIED_OK)
    assert second.status_code == 200
    assert second.json() == first.json()
    assert Execution.objects.get(pk=execution.pk).finished_at == stamp
    hook.assert_called_once()
    assert AuditEvent.objects.filter(action="execution.result").count() == 1


def test_conflicting_terminal_result_is_409(key, execution, hook):
    send(key, execution.id, VERIFIED_OK)
    for body in (FAILED, {**VERIFIED_OK, "response_status": 201}):
        response = send(key, execution.id, body)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "CONFLICT"
    assert Execution.objects.get(pk=execution.pk).status == "SUCCEEDED"
    hook.assert_called_once()


def test_failed_then_success_is_409(key, execution):
    send(key, execution.id, FAILED)
    assert send(key, execution.id, VERIFIED_OK).status_code == 409


# --- tenancy / roles ---------------------------------------------------------------------------
def test_foreign_execution_is_the_same_404_as_missing_and_audited(execution):
    other = make_tenant("TEN-OTHER")
    foreign = api_key_client(other)
    hit = send(foreign, execution.id, VERIFIED_OK)
    miss = send(foreign, "EXE-999999", VERIFIED_OK)
    assert hit.status_code == miss.status_code == 404
    assert strip_cid(hit) == strip_cid(miss)
    assert Execution.objects.get(pk=execution.pk).status == "PENDING"
    (row,) = AuditEvent.objects.filter(action="security.cross_tenant_denied")
    assert row.tenant_id == "TEN-OTHER" and row.actor == "SYSTEM"
    assert (row.entity_type, row.entity_id) == ("Execution", execution.id)


def test_tenant_in_body_is_ignored(key, acme):
    other = make_tenant("TEN-OTHER")
    foreign = make_execution(other)
    assert send(key, foreign.id, {**VERIFIED_OK, "tenant_id": "TEN-OTHER"}).status_code == 404
    assert Execution.objects.get(pk=foreign.pk).status == "PENDING"


@pytest.mark.parametrize("role", ["ADMIN", "PROCUREMENT_MANAGER", "OPS_MANAGER", "VIEWER"])
def test_user_tokens_are_403(acme, execution, role):
    client = jwt_client(make_user(acme, role=role))
    assert send(client, execution.id, VERIFIED_OK).status_code == 403
    assert Execution.objects.get(pk=execution.pk).status == "PENDING"


def test_anonymous_is_401(execution):
    assert send(APIClient(), execution.id, VERIFIED_OK).status_code == 401


# --- size cap ----------------------------------------------------------------------------------
def test_large_payload_is_truncated_with_a_marker_not_rejected(key, execution):
    payload = {"rows": ["x" * 100 for _ in range(1000)], "api_key": "sgk_secret"}
    response = send(key, execution.id, {**VERIFIED_OK, "response_payload": payload})
    assert response.status_code == 200
    stored = Execution.objects.get(pk=execution.pk).response_payload
    assert stored["_truncated"] is True
    assert stored["original_size_bytes"] > executions.PAYLOAD_MAX_BYTES
    assert len(json.dumps(stored).encode()) <= executions.PAYLOAD_MAX_BYTES
    assert "sgk_secret" not in json.dumps(stored)


def test_payload_just_under_the_cap_is_kept(key, execution):
    payload = {"blob": "y" * 19_000}
    send(key, execution.id, {**VERIFIED_OK, "response_payload": payload})
    assert Execution.objects.get(pk=execution.pk).response_payload == payload


# --- hook --------------------------------------------------------------------------------------
def test_hook_failure_does_not_lose_the_result(key, execution, hook):
    hook.side_effect = RuntimeError("workflow down")
    response = send(key, execution.id, VERIFIED_OK)
    assert response.status_code == 200
    assert Execution.objects.get(pk=execution.pk).status == "SUCCEEDED"


def test_missing_workflow_service_is_logged_not_fatal(monkeypatch, caplog, execution):
    monkeypatch.undo()  # use the real hook (the autouse spy is removed)
    import logging

    with caplog.at_level(logging.INFO, logger="apps.integrations.hooks"):
        hooks.on_execution_result(execution)
    assert "workflow service not available" in caplog.text


def test_hook_delegates_to_the_workflow_service_when_present(monkeypatch, execution):
    import sys
    import types

    monkeypatch.undo()
    fake = types.ModuleType("apps.workflow.services")
    fake.on_execution_result = mock.MagicMock()
    monkeypatch.setitem(sys.modules, "apps.workflow.services", fake)
    hooks.on_execution_result(execution)
    fake.on_execution_result.assert_called_once_with(execution)
