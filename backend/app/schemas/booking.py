import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.booking import BookingStatus


class BookingCreate(BaseModel):
    slot_id: uuid.UUID


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    booking_id: uuid.UUID
    slot_id: uuid.UUID
    guide_id: uuid.UUID
    tourist_id: uuid.UUID
    status: BookingStatus
    created_at: datetime
