import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import BookingCreate, BookingRead
from app.services import bookings as bookings_service

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("", response_model=BookingRead, status_code=201)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.create_booking(payload, db, current_user)


# Declared BEFORE /{booking_id} so "my" isn't parsed as a UUID and 422'd.
@router.get("/my", response_model=list[BookingRead])
def list_my_bookings(
    role: Literal["tourist", "guide"] = Query(alias="as"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.list_my_bookings(db, current_user, role)


@router.get("/{booking_id}", response_model=BookingRead)
def get_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.get_booking(booking_id, db, current_user)


@router.post("/{booking_id}/confirm", response_model=BookingRead)
def confirm_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.confirm_booking(booking_id, db, current_user)


@router.post("/{booking_id}/complete", response_model=BookingRead)
def complete_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.complete_booking(booking_id, db, current_user)


@router.post("/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bookings_service.cancel_booking(booking_id, db, current_user)
