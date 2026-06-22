import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SEED_USER_EMAIL, SessionLocal
from app.main import app
from app.models import User
from app.services.auth import create_access_token, hash_password


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seeded_user():
    """Ensures the stand-in seed user exists, matching scripts/seed.py's
    logic. Reused here so tests don't depend on the script having been run
    manually first."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == SEED_USER_EMAIL).first()
        if user is None:
            user = User(
                email=SEED_USER_EMAIL,
                password_hash=hash_password("throwaway-not-a-real-login"),
                name="Seed Guide",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        yield user
    finally:
        db.close()


@pytest.fixture
def auth_headers():
    """Registers a fresh user and returns ready-to-use Authorization headers,
    so tests don't depend on the seed user/stub for authenticated requests."""
    db = SessionLocal()
    try:
        email = f"{uuid.uuid4()}@atourtest.dev"
        user = User(
            email=email,
            password_hash=hash_password("test-password-123"),
            name="Test User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(str(user.user_id))
        yield {"Authorization": f"Bearer {token}"}
        db.delete(user)
        db.commit()
    finally:
        db.close()
