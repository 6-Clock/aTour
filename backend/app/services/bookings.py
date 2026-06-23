import uuid
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Booking, BookingStatus, Slot, User
from app.schemas import BookingCreate

# Statuses a booking can still be cancelled from (and that hold the date closed).
ACTIVE_STATUSES = (BookingStatus.pending, BookingStatus.confirmed)


def create_booking(payload: BookingCreate, db: Session, current_user: User) -> Booking:
    slot = db.get(Slot, payload.slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="slot not found")
    # A date is bookable by exactly one tourist: the first booking closes the
    # slot, so any later attempt (by anyone, including the same tourist) gets
    # this 409. Cancelling reopens it.
    if not slot.available:
        raise HTTPException(status_code=409, detail="this date is already booked")

    guide_id = slot.post.user_id
    if guide_id == current_user.user_id:
        raise HTTPException(status_code=409, detail="you cannot book your own post")

    booking = Booking(
        slot_id=slot.slot_id,
        guide_id=guide_id,
        tourist_id=current_user.user_id,
        status=BookingStatus.pending,
    )
    db.add(booking)
    slot.available = False  # close the date so no one else can book it
    db.commit()
    db.refresh(booking)
    return booking


def _get_participant_booking(
    booking_id: uuid.UUID, db: Session, current_user: User
) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if current_user.user_id not in (booking.guide_id, booking.tourist_id):
        raise HTTPException(status_code=403, detail="not your booking")
    return booking


def get_booking(booking_id: uuid.UUID, db: Session, current_user: User) -> Booking:
    return _get_participant_booking(booking_id, db, current_user)


def list_my_bookings(
    db: Session, current_user: User, role: Literal["tourist", "guide"]
) -> list[Booking]:
    column = Booking.tourist_id if role == "tourist" else Booking.guide_id
    stmt = (
        select(Booking)
        .where(column == current_user.user_id)
        # Eager-load slot -> post so BookingRead's post_title/slot_date/post_id
        # properties don't fire a query per row (N+1).
        .options(joinedload(Booking.slot).joinedload(Slot.post))
        .order_by(Booking.created_at.desc())
    )
    return db.scalars(stmt).all()


def confirm_booking(
    booking_id: uuid.UUID, db: Session, current_user: User
) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if booking.guide_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="only the guide can confirm")
    if booking.status != BookingStatus.pending:
        raise HTTPException(
            status_code=422, detail="only a pending booking can be confirmed"
        )
    booking.status = BookingStatus.confirmed
    db.commit()
    db.refresh(booking)
    return booking


def complete_booking(
    booking_id: uuid.UUID, db: Session, current_user: User
) -> Booking:
    # Guide-only confirmed -> completed. This is the only path to `completed`,
    # and Ticket 8 reviews are gated on it (only a completed booking is
    # reviewable). v1 has the guide mark it done manually; a future scheduled
    # job could auto-complete confirmed bookings once the slot date passes.
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="booking not found")
    if booking.guide_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="only the guide can complete")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(
            status_code=422, detail="only a confirmed booking can be completed"
        )
    booking.status = BookingStatus.completed
    db.commit()
    db.refresh(booking)
    return booking


def cancel_booking(booking_id: uuid.UUID, db: Session, current_user: User) -> Booking:
    booking = _get_participant_booking(booking_id, db, current_user)
    if booking.status not in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"cannot cancel a {booking.status.value} booking"
        )
    # Cancelling frees the seat implicitly: capacity counts only ACTIVE_STATUSES.
    booking.status = BookingStatus.cancelled
    # Reopen the date so it can be booked again.
    booking.slot.available = True
    db.commit()
    db.refresh(booking)
    return booking
