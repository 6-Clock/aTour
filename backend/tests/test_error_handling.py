import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app, get_current_user


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


def test_get_current_user_raises_500_when_seed_user_missing():
    class _EmptySession:
        def scalar(self, *args, **kwargs):
            return None

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(db=_EmptySession())
    assert exc_info.value.status_code == 500
    assert "seed user not found" in exc_info.value.detail
