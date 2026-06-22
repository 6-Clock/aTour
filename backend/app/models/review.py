import datetime as _dt
import uuid as _uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# One review per booking (1-to-1), enforced by the UNIQUE on booking_id. Only a
# completed booking is reviewable; guide_id/post_id are NOT stored here — they
# derive via Review -> Booking (-> Slot -> Post) in the list queries.
class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_1_5"),
    )

    review_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    booking_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.booking_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[_dt.datetime] = mapped_column(server_default=text("now()"))

    booking: Mapped["Booking"] = relationship()  # noqa: F821
