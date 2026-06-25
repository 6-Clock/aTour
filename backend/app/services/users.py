import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Review, User
from app.schemas import UserUpdate
from app.schemas.user import UserPublic


def get_public_profile(user_id: uuid.UUID, db: Session) -> UserPublic:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    # avg_rating: AVG(Review.rating) over every review received on this user's
    # bookings as guide (Review -> Booking where Booking.guide_id == user_id).
    # AVG over no rows is NULL -> stays None for a guide with no reviews yet.
    avg_rating = db.scalar(
        select(func.avg(Review.rating))
        .join(Booking, Review.booking_id == Booking.booking_id)
        .where(Booking.guide_id == user_id)
    )
    review_count = db.scalar(
        select(func.count(Review.review_id))
        .join(Booking, Review.booking_id == Booking.booking_id)
        .where(Booking.guide_id == user_id)
    )
    tours_completed = db.scalar(
        select(func.count(Booking.booking_id))
        .where(Booking.guide_id == user_id, Booking.status == BookingStatus.completed)
    )
    # Build the response explicitly: computed fields aren't columns on User, so
    # from_attributes alone would leave them at their defaults.
    return UserPublic.model_validate(user).model_copy(
        update={
            "avg_rating": float(avg_rating) if avg_rating is not None else None,
            "review_count": review_count or 0,
            "tours_completed": tours_completed or 0,
        }
    )


def get_me(current_user: User) -> User:
    return current_user


def update_me(payload: UserUpdate, db: Session, current_user: User) -> User:
    # exclude_unset => only the fields the client actually sent are applied, so a
    # partial save (e.g. {"bio": "..."}) never wipes city/languages/etc.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
