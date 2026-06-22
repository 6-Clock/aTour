import uuid
from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Post, Slot, User
from app.schemas import SlotsAddRequest
from app.services.posts import get_owned_post_or_404


def get_owned_slot_or_404(
    slot_id: uuid.UUID, db: Session, current_user: User
) -> Slot:
    # Slots are toggled/deleted at /api/slots/{id} (not nested under the post),
    # so ownership resolves through slot -> post -> user_id.
    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="slot not found")
    if slot.post.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="not the owner of this slot")
    return slot


def add_slots(
    post_id: uuid.UUID, payload: SlotsAddRequest, db: Session, current_user: User
) -> list[Slot]:
    post = get_owned_post_or_404(post_id, db, current_user)
    for slot_date in payload.dates:
        db.add(Slot(post_id=post.post_id, date=slot_date))
    try:
        db.commit()
    except IntegrityError:
        # UNIQUE(post_id, date) violation — a date already has a slot (or the
        # batch repeats a date). All-or-nothing: reject the whole request.
        db.rollback()
        raise HTTPException(
            status_code=409, detail="a slot already exists for one of these dates"
        )
    db.refresh(post)
    return post.slots


def list_slots(
    post_id: uuid.UUID, db: Session, current_user: User | None
) -> list[Slot]:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    is_owner = current_user is not None and current_user.user_id == post.user_id
    stmt = select(Slot).where(Slot.post_id == post_id)
    if not is_owner:
        # Public sees only future, open dates.
        stmt = stmt.where(Slot.available.is_(True), Slot.date >= date.today())
    stmt = stmt.order_by(Slot.date)
    return db.scalars(stmt).all()


def toggle_slot(slot_id: uuid.UUID, db: Session, current_user: User) -> Slot:
    slot = get_owned_slot_or_404(slot_id, db, current_user)
    slot.available = not slot.available
    db.commit()
    db.refresh(slot)
    return slot


def delete_slot(slot_id: uuid.UUID, db: Session, current_user: User) -> None:
    slot = get_owned_slot_or_404(slot_id, db, current_user)
    # TODO (Ticket 7): block deletion with 409 if a non-cancelled booking exists
    # for this slot. The Booking table doesn't exist yet, so no booking can
    # reference it — deletion is unconditionally safe for now. See TODOS.md.
    db.delete(slot)
    db.commit()
