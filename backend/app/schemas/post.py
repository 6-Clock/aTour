import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PostCreate(BaseModel):
    title: str
    description: str | None = None
    booking_fee: Decimal = Field(ge=0)
    max_group_size: int = Field(ge=1)


class PostUpdate(BaseModel):
    """Partial update for PUT /api/posts/{post_id}. All-Optional so a one-field
    edit doesn't wipe the rest — the service applies model_dump(exclude_unset=True).
    Same constraints as PostCreate so bad values are a 422, not a DB error."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    booking_fee: Decimal | None = Field(default=None, ge=0)
    max_group_size: int | None = Field(default=None, ge=1)


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    booking_fee: Decimal
    max_group_size: int
    posted: bool
    created_at: datetime


class PostDetail(PostRead):
    """Full post detail for GET /api/posts/{post_id}. images is [] until the
    PostImage table exists (Ticket 5); see services/posts.py + TODOS.md."""

    images: list = []
