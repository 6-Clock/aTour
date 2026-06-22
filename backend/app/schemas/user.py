import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    """Public profile — no email, no password_hash. Used by the unauthenticated
    GET /api/users/{user_id} route. avg_rating is the mean of reviews received as
    a guide, or None when the guide has no reviews yet; see services/users.py."""

    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    name: str
    bio: str | None
    city: str | None
    languages: list[str] | None
    profile_photo: str | None
    avg_rating: float | None = None
    created_at: datetime


class UserMe(UserPublic):
    """The authenticated user's own view — adds email."""

    email: str


class UserUpdate(BaseModel):
    """Partial update for PUT /api/users/me. Every field is optional so a
    one-field save (e.g. {"bio": "..."}) does NOT wipe the others — the service
    applies model_dump(exclude_unset=True). max_length mirrors the model columns
    so bad input is a 422, not a raw DB error."""

    name: str | None = Field(default=None, max_length=100)
    bio: str | None = None
    city: str | None = Field(default=None, max_length=100)
    languages: list[str] | None = None
    profile_photo: str | None = None
