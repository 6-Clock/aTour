import datetime as _dt
import uuid as _uuid

from sqlalchemy import text, ARRAY, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


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
