import datetime as _dt
import uuid as _uuid

from sqlalchemy import Boolean, Date, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Slot(Base):
    __tablename__ = "slots"
    __table_args__ = (
        # One slot per post per calendar day. Named so a duplicate insert
        # produces a readable, catchable constraint error.
        UniqueConstraint("post_id", "date", name="uq_slot_post_date"),
    )

    slot_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    post_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("posts.post_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Indexed for availability lookups (public list filters on date >= today).
    # post_id is NOT separately indexed: the uq_slot_post_date composite already
    # covers post_id as its leftmost prefix.
    date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    available: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )

    post: Mapped["Post"] = relationship(back_populates="slots")  # noqa: F821
