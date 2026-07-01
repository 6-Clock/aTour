import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    """Create a review for a completed booking. rating is validated 1–5 by
    Pydantic before it reaches the DB CHECK; comment is optional."""

    booking_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: uuid.UUID
    booking_id: uuid.UUID
    rating: int
    comment: str | None
    created_at: datetime
    reviewer_name: str | None = None
