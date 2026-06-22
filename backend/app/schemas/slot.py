import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class SlotsAddRequest(BaseModel):
    """Add one or more date slots to a post (bulk accepted). All-or-nothing:
    any duplicate (post_id, date) rejects the whole batch with 409."""

    dates: list[date] = Field(min_length=1)


class SlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slot_id: uuid.UUID
    post_id: uuid.UUID
    date: date
    available: bool
