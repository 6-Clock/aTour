import uuid

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.services.auth import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
# auto_error=False => no token yields None instead of a 401, so a single route
# can serve both anonymous and authenticated callers (e.g. "owner sees their
# unpublished posts, everyone else sees only published").
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="api/auth/login", auto_error=False
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="invalid token")
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolve the caller's User if a valid token is present, else None. Never
    raises 401 — an absent, expired, or malformed token is just 'anonymous'.
    Used by routes whose visibility depends on whether the owner is calling."""
    if token is None:
        return None
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
    return db.get(User, user_id)
