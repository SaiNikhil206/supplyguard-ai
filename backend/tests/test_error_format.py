import uuid

import pytest
from rest_framework import exceptions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView


class Conflict(exceptions.APIException):
    status_code = 409
    default_detail = "Invalid state transition."


def make_view(exc=None, permission=AllowAny):
    class View(APIView):
        permission_classes = [permission]

        def get(self, request):
            if exc is not None:
                raise exc
            return None

    return View.as_view()


def call(view, **headers):
    return view(APIRequestFactory().get("/x", **headers))


def error_of(response):
    assert set(response.data) == {"error"}
    error = response.data["error"]
    assert set(error) == {"code", "message", "details", "correlation_id"}
    uuid.UUID(error["correlation_id"])  # well-formed
    return error


@pytest.mark.parametrize(
    ("exc", "status", "code"),
    [
        (exceptions.ValidationError({"qty": ["Required."]}), 400, "VALIDATION_ERROR"),
        (exceptions.PermissionDenied(), 403, "FORBIDDEN"),
        (exceptions.NotFound(), 404, "NOT_FOUND"),
        (Conflict(), 409, "CONFLICT"),
        (exceptions.MethodNotAllowed("PUT"), 405, "VALIDATION_ERROR"),
    ],
)
def test_errors_use_contract_body(exc, status, code):
    response = call(make_view(exc))
    assert response.status_code == status
    assert error_of(response)["code"] == code


def test_validation_details_are_preserved():
    response = call(make_view(exceptions.ValidationError({"qty": ["Required."]})))
    assert error_of(response)["details"] == {"qty": ["Required."]}


def test_unauthenticated_is_401_with_contract_body():
    response = call(make_view(permission=IsAuthenticated))
    assert response.status_code == 401
    assert error_of(response)["code"] == "UNAUTHENTICATED"


def test_correlation_id_is_echoed_when_valid():
    cid = str(uuid.uuid4())
    response = call(make_view(exceptions.NotFound()), HTTP_X_CORRELATION_ID=cid)
    assert error_of(response)["correlation_id"] == cid


def test_bad_correlation_id_is_replaced():
    response = call(make_view(exceptions.NotFound()), HTTP_X_CORRELATION_ID="not-a-uuid")
    assert error_of(response)["correlation_id"] != "not-a-uuid"
