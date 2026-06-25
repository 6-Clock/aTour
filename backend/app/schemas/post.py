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
    # First image by display_order (None when the post has no images). Lets
    # list/feed cards show a cover without fetching full detail per post.
    cover_image_url: str | None = None
    # Guide's display name — populated when Post.user is selectinloaded; None
    # when the relationship isn't loaded (e.g. create/update responses).
    guide_name: str | None = None


class PostImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    image_id: uuid.UUID
    post_id: uuid.UUID
    image_url: str
    display_order: int


class ImageAddRequest(BaseModel):
    """Add one or more image URLs to a post. Upload happens client-side
    (Supabase signed URLs); the API only stores the resulting URL strings."""

    image_urls: list[str] = Field(min_length=1)


class ImageReorderRequest(BaseModel):
    """The post's image_ids in the desired order. Must be exactly the post's
    current image set — display_order is set to each id's index."""

    image_ids: list[uuid.UUID] = Field(min_length=1)


class PostDetail(PostRead):
    """Full post detail for GET /api/posts/{post_id}, including ordered images
    (populated via the Post.images relationship)."""

    images: list[PostImageRead] = []
