import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User
from app.schemas import UserUpdate


def get_public_profile(user_id: uuid.UUID, db: Session) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    # avg_rating is left as the UserPublic default (None): Review/Booking don't
    # exist yet (Ticket 8). When they land, compute AVG(Review.rating) joined
    # Review -> Booking where Booking.guide_id == user_id here. See TODOS.md.
    return user


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
