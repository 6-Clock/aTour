"""Idempotent seed script — creates the one stand-in User row used by
get_current_user() until real auth (Ticket 2) replaces it. Safe to re-run
after `docker compose down -v`.

Run from backend/: python -m scripts.seed
"""
from app.database import SEED_USER_EMAIL, SessionLocal
from app.models import User
from app.services.auth import hash_password

THROWAWAY_PASSWORD = "throwaway-not-a-real-login"


def seed() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == SEED_USER_EMAIL).first()
        if existing is not None:
            print(f"Seed user already exists: {existing.user_id}")
            return

        password_hash = hash_password(THROWAWAY_PASSWORD)

        user = User(
            email=SEED_USER_EMAIL,
            password_hash=password_hash,
            name="Seed Guide",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created seed user: {user.user_id} ({user.email})")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
