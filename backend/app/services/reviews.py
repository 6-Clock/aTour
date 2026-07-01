import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Post, Review, Slot, User
from app.schemas import ReviewCreate
from app.schemas.review import ReviewRead


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
) -> list[ReviewRead]:
    # 4-table join: Review has no post_id — must traverse Review->Booking->Slot->Post.
    # Use db.execute (not db.scalars) because the query returns (Review, str) tuples.
    if db.get(Post, post_id) is None:
        raise HTTPException(status_code=404, detail="post not found")
    stmt = (
        select(Review, User.name.label("reviewer_name"))
        .join(Booking, Review.booking_id == Booking.booking_id)
        .join(Slot, Booking.slot_id == Slot.slot_id)
        .join(User, Booking.tourist_id == User.user_id)
        .where(Slot.post_id == post_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    return [
        ReviewRead.model_validate(row.Review).model_copy(update={"reviewer_name": row.reviewer_name})
        for row in rows
    ]


def list_user_reviews(
    user_id: uuid.UUID, db: Session, limit: int, offset: int
) -> list[ReviewRead]:
    # 3-table join: Booking.guide_id is denormalized so no Slot join is needed.
    # Use db.execute (not db.scalars) because the query returns (Review, str) tuples.
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="user not found")
    stmt = (
        select(Review, User.name.label("reviewer_name"))
        .join(Booking, Review.booking_id == Booking.booking_id)
        .join(User, Booking.tourist_id == User.user_id)
        .where(Booking.guide_id == user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    return [
        ReviewRead.model_validate(row.Review).model_copy(update={"reviewer_name": row.reviewer_name})
        for row in rows
    ]
