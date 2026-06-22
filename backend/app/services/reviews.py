import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Post, Review, Slot, User
from app.schemas import ReviewCreate


def create_review(payload: ReviewCreate, db: Session, current_user: User) -> Review:
    # Eligibility in one query: the booking must exist, belong to this tourist,
    # and be completed. Any miss collapses to a single 403 so a caller can't
    # probe which condition failed (e.g. distinguish "not mine" from "exists").
    booking = db.scalar(
        select(Booking).where(
            Booking.booking_id == payload.booking_id,
            Booking.tourist_id == current_user.user_id,
            Booking.status == BookingStatus.completed,
        )
    )
    if booking is None:
        raise HTTPException(
            status_code=403, detail="booking not found or not eligible for review"
        )

    review = Review(
        booking_id=payload.booking_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:
        # UNIQUE(booking_id) — a review already exists for this booking. Reviews
        # are one-per-booking and can't be edited/deleted in v1.
        db.rollback()
        raise HTTPException(
            status_code=409, detail="a review already exists for this booking"
        )
    db.refresh(review)
    return review


def list_post_reviews(
    post_id: uuid.UUID, db: Session, limit: int, offset: int
) -> list[Review]:
    # Review -> Booking -> Slot, filtered to the post. 404 so an unknown post is
    # distinguishable from a real post with no reviews (which returns []).
    if db.get(Post, post_id) is None:
        raise HTTPException(status_code=404, detail="post not found")
    stmt = (
        select(Review)
        .join(Booking, Review.booking_id == Booking.booking_id)
        .join(Slot, Booking.slot_id == Slot.slot_id)
        .where(Slot.post_id == post_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


def list_user_reviews(
    user_id: uuid.UUID, db: Session, limit: int, offset: int
) -> list[Review]:
    # All reviews received by a guide across their posts. Booking.guide_id is
    # denormalized, so no Slot/Post join is needed here.
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="user not found")
    stmt = (
        select(Review)
        .join(Booking, Review.booking_id == Booking.booking_id)
        .where(Booking.guide_id == user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()
