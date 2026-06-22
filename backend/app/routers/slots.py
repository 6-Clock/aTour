import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_current_user_optional, get_db
from app.models import User
from app.schemas import SlotRead, SlotsAddRequest
from app.services import slots as slots_service

# Slots are created/listed under a post, but toggled/deleted by their own id.
post_slots_router = APIRouter(prefix="/api/posts", tags=["slots"])
slots_router = APIRouter(prefix="/api/slots", tags=["slots"])


@post_slots_router.post(
    "/{post_id}/slots", response_model=list[SlotRead], status_code=201
)
def add_slots(
    post_id: uuid.UUID,
    payload: SlotsAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return slots_service.add_slots(post_id, payload, db, current_user)


@post_slots_router.get("/{post_id}/slots", response_model=list[SlotRead])
def list_slots(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    return slots_service.list_slots(post_id, db, current_user)


@slots_router.patch("/{slot_id}/toggle", response_model=SlotRead)
def toggle_slot(
    slot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return slots_service.toggle_slot(slot_id, db, current_user)


@slots_router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slots_service.delete_slot(slot_id, db, current_user)
