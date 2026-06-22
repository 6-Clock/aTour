import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.dependencies import get_current_user, get_db
from app.main import app


class _RaisingSession:
    def execute(self, *args, **kwargs):
        raise OperationalError("statement", {}, Exception("connection refused"))


def test_health_returns_503_when_db_unreachable():
    app.dependency_overrides[get_db] = lambda: _RaisingSession()
    try:
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 503
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_get_current_user_rejects_garbage_token():
    class _UnusedSession:
        def get(self, *args, **kwargs):
            raise AssertionError("should not query db for an undecodable token")

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(token="not-a-real-jwt", db=_UnusedSession())
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "invalid token"
