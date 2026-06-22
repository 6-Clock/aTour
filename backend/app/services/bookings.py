import uuid
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Slot, User
from app.schemas import BookingCreate

# Statuses that occupy a seat (used for both capacity and slot-delete guard).
ACTIVE_STATUSES = (BookingStatus.pending, BookingStatus.confirmed)


def _active_booking_count(slot_id: uuid.UUID, db: Session) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Booking)
        .where(Booking.slot_id == slot_id, Booking.status.in_(ACTIVE_STATUSES))
    )


def create_booking(payload: BookingCreate, db: Session, current_user: User) -> Booking:
    slot = db.get(Slot, payload.slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="slot not found")
    if not slot.available:
        raise HTTPException(status_code=409, detail="slot is not open for booking")

    guide_id = slot.post.user_id
    if guide_id == current_user.user_id:
        raise HTTPException(status_code=409, detail="you cannot book your own post")
    if _active_booking_count(slot.slot_id, db) >= slot.post.max_group_size:
        raise HTTPException(status_code=409, detail="this slot is full")

    booking = Booking(
        slot_id=slot.slot_id,
        guide_id=guide_id,
        tourist_id=current_user.user_id,
        status=BookingStatus.pending,
    )
    db.add(booking)
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


def cancel_booking(booking_id: uuid.UUID, db: Session, current_user: User) -> Booking:
    booking = _get_participant_booking(booking_id, db, current_user)
    if booking.status not in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"cannot cancel a {booking.status.value} booking"
        )
    # Cancelling frees the seat implicitly: capacity counts only ACTIVE_STATUSES.
    booking.status = BookingStatus.cancelled
    db.commit()
    db.refresh(booking)
    return booking
