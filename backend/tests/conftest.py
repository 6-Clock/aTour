import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import SEED_USER_EMAIL, SessionLocal
from app.main import app
from app.models import Post, User
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


@pytest.fixture
def make_user():
    """Factory: create a real User row with given profile fields and return
    (user_id, email, auth_headers). Exposes the user_id (needed for routes like
    GET /api/users/{user_id}) and can mint several users in one test. All created
    rows are cleaned up at teardown; their posts cascade via the FK."""
    created: list[uuid.UUID] = []

    def _make(**fields) -> tuple[uuid.UUID, str, dict[str, str]]:
        db = SessionLocal()
        try:
            email = f"{uuid.uuid4()}@atourtest.dev"
            user = User(
                email=email,
                password_hash=hash_password("test-password-123"),
                name=fields.pop("name", "Test User"),
                **fields,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created.append(user.user_id)
            token = create_access_token(str(user.user_id))
            return user.user_id, email, {"Authorization": f"Bearer {token}"}
        finally:
            db.close()

    yield _make

    db = SessionLocal()
    try:
        for uid in created:
            user = db.get(User, uid)
            if user is not None:
                db.delete(user)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def make_post():
    """Factory: insert a Post directly (bypassing the API/max-5 guard) so tests
    can set up arbitrary owners and published state. Returns the post_id. Cleans
    up at teardown (owner deletion also cascades, this is belt-and-suspenders)."""
    created: list[uuid.UUID] = []

    def _make(user_id: uuid.UUID, *, posted: bool = False, **fields) -> uuid.UUID:
        db = SessionLocal()
        try:
            post = Post(
                user_id=user_id,
                title=fields.pop("title", "Test Post"),
                booking_fee=fields.pop("booking_fee", Decimal("10.00")),
                max_group_size=fields.pop("max_group_size", 4),
                posted=posted,
                **fields,
            )
            db.add(post)
            db.commit()
            db.refresh(post)
            created.append(post.post_id)
            return post.post_id
        finally:
            db.close()

    yield _make

    db = SessionLocal()
    try:
        for pid in created:
            post = db.get(Post, pid)
            if post is not None:
                db.delete(post)
        db.commit()
    finally:
        db.close()
