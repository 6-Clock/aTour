import datetime as _dt
import enum
import uuid as _uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


# Status lifecycle (Ticket 7 builds pending -> confirmed/cancelled; Ticket 8
# adds the guide-only confirmed -> completed transition that gates reviews):
#
#   pending ──confirm──► confirmed ──complete──► completed
#      │                    │
#      └──────cancel────────┴──► cancelled
#
#   (completed is terminal; only a completed booking is reviewable — see
#    services/reviews.py)
class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("guide_id != tourist_id", name="ck_booking_guide_ne_tourist"),
    )

    booking_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    slot_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("slots.slot_id", ondelete="CASCADE"),
        nullable=False,
    )
    # guide_id is denormalized from slot -> post -> user_id at insert time so the
    # guide dashboard query skips two joins.
    guide_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    tourist_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status"),
        default=BookingStatus.pending,
        nullable=False,
    )
    created_at: Mapped[_dt.datetime] = mapped_column(server_default=text("now()"))

    slot: Mapped["Slot"] = relationship()  # noqa: F821
