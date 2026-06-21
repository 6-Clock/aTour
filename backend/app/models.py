import datetime as _dt
import uuid as _uuid
from decimal import Decimal

from sqlalchemy import text, ARRAY, CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# class Contact(Base):
#     __tablename__ = "UserInfo"
#     id = _sql.Column(_sql.Integer, primary_key=True, index=True, unique=True)
#     first_name = _sql.Column(_sql.String, primary_key=False, index=True)
#     last_name = _sql.Column(_sql.String, primary_key=False, index=True, unique=True)
#     email = _sql.Column(_sql.String, unique=True, index=True)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    profile_photo: Mapped[str | None] = mapped_column(default=None)
    bio: Mapped[str | None] = mapped_column(default=None)
    languages: Mapped[list[str] | None] = mapped_column(ARRAY(String), default=None)
    city: Mapped[str | None] = mapped_column(String(100), default=None)
    created_at: Mapped[_dt.datetime] = mapped_column(server_default=text("now()"))


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