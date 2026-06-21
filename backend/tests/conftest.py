import bcrypt
import pytest
from fastapi.testclient import TestClient

from app.database import SEED_USER_EMAIL, SessionLocal
from app.main import app
from app.models import User


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
            password_hash = bcrypt.hashpw(
                b"throwaway-not-a-real-login", bcrypt.gensalt()
            ).decode("utf-8")
            user = User(
                email=SEED_USER_EMAIL, password_hash=password_hash, name="Seed Guide"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        yield user
    finally:
        db.close()
