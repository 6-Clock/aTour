import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import PostCreate, PostRead
from app.services import posts as posts_service

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.post("", response_model=PostRead, status_code=201)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.create_post(payload, db, current_user)


@router.patch("/{post_id}/publish", response_model=PostRead)
def publish_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.publish_post(post_id, db, current_user)


@router.get("", response_model=list[PostRead])
def list_posts(db: Session = Depends(get_db)):
    return posts_service.list_published_posts(db)
