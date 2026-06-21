import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PostCreate(BaseModel):
    title: str
    description: str | None = None
    booking_fee: Decimal = Field(ge=0)
    max_group_size: int = Field(ge=1)


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
