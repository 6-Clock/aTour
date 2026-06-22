import datetime as _dt
import uuid as _uuid
from decimal import Decimal

from sqlalchemy import text, CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint("booking_fee >= 0", name="ck_post_booking_fee_nonneg"),
        CheckConstraint("max_group_size >= 1", name="ck_post_max_group_size_min1"),
    )

    post_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(default=None)
    booking_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_group_size: Mapped[int] = mapped_column(nullable=False)
    posted: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    created_at: Mapped[_dt.datetime] = mapped_column(server_default=text("now()"))

    # Ordered child images. DB enforces ON DELETE CASCADE; delete-orphan keeps
    # the ORM session consistent when images are removed from the collection.
    images: Mapped[list["PostImage"]] = relationship(  # noqa: F821
        back_populates="post",
        order_by="PostImage.display_order",
        cascade="all, delete-orphan",
    )
    slots: Mapped[list["Slot"]] = relationship(  # noqa: F821
        back_populates="post",
        order_by="Slot.date",
        cascade="all, delete-orphan",
    )
