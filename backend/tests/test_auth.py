import uuid

from app.database import SessionLocal
from app.models import Post, User
from app.services.auth import hash_password, verify_password


def _cleanup_user(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            db.delete(user)
            db.commit()
    finally:
        db.close()


def _cleanup_post(post_id: str) -> None:
    db = SessionLocal()
    try:
        post = db.get(Post, post_id)
        if post is not None:
            db.delete(post)
            db.commit()
    finally:
        db.close()


def test_hash_password_verify_password_roundtrip():
    password = "correct-horse-battery-staple"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_register_creates_user_and_returns_token(client):
    email = f"{uuid.uuid4()}@atourtest.dev"
    try:
        response = client.post(
            "/api/auth/register",
            json={"email": email, "password": "test-password-123", "name": "New Guide"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
    finally:
        _cleanup_user(email)


def test_register_duplicate_email_rejected(client):
    email = f"{uuid.uuid4()}@atourtest.dev"
    try:
        first = client.post(
            "/api/auth/register",
            json={"email": email, "password": "test-password-123", "name": "First"},
        )
        assert first.status_code == 201

        second = client.post(
            "/api/auth/register",
            json={"email": email, "password": "another-password", "name": "Second"},
        )
        assert second.status_code == 409
    finally:
        _cleanup_user(email)


def test_register_short_password_rejected(client):
    email = f"{uuid.uuid4()}@atourtest.dev"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "short", "name": "New Guide"},
    )
    assert response.status_code == 422


def test_login_success_returns_token(client):
    email = f"{uuid.uuid4()}@atourtest.dev"
    password = "test-password-123"
    try:
        register_response = client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "name": "Login Tester"},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert login_response.status_code == 200
        assert login_response.json()["access_token"]
    finally:
        _cleanup_user(email)


def test_login_wrong_password_rejected(client):
    email = f"{uuid.uuid4()}@atourtest.dev"
    try:
        register_response = client.post(
            "/api/auth/register",
            json={"email": email, "password": "test-password-123", "name": "Tester"},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/api/auth/login", json={"email": email, "password": "wrong-password"}
        )
        assert login_response.status_code == 401
    finally:
        _cleanup_user(email)


def test_login_nonexistent_email_rejected(client):
    response = client.post(
        "/api/auth/login",
        json={"email": f"{uuid.uuid4()}@atourtest.dev", "password": "doesnt-matter"},
    )
    assert response.status_code == 401


def test_login_unknown_and_wrong_password_share_same_message(client):
    """Generic 401 message for both cases -- not distinguishable, so an
    attacker can't use the error to enumerate registered emails."""
    email = f"{uuid.uuid4()}@atourtest.dev"
    try:
        client.post(
            "/api/auth/register",
            json={"email": email, "password": "test-password-123", "name": "Tester"},
        )
        wrong_password = client.post(
            "/api/auth/login", json={"email": email, "password": "wrong-password"}
        )
        unknown_email = client.post(
            "/api/auth/login",
            json={"email": f"{uuid.uuid4()}@atourtest.dev", "password": "wrong-password"},
        )
        assert wrong_password.json()["detail"] == unknown_email.json()["detail"]
    finally:
        _cleanup_user(email)


def test_create_post_without_token_rejected(client):
    response = client.post(
        "/api/posts",
        json={"title": "No Auth", "booking_fee": "10.00", "max_group_size": 2},
    )
    assert response.status_code == 401


def test_publish_post_by_non_owner_rejected(client, auth_headers):
    other_email = f"{uuid.uuid4()}@atourtest.dev"
    try:
        create_response = client.post(
            "/api/posts",
            json={"title": "Owned Post", "booking_fee": "10.00", "max_group_size": 2},
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        post_id = create_response.json()["post_id"]

        register_response = client.post(
            "/api/auth/register",
            json={
                "email": other_email,
                "password": "test-password-123",
                "name": "Other User",
            },
        )
        other_token = register_response.json()["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}

        publish_response = client.patch(
            f"/api/posts/{post_id}/publish", headers=other_headers
        )
        assert publish_response.status_code == 403
    finally:
        _cleanup_post(post_id)
        _cleanup_user(other_email)
