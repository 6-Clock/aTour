import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_current_user_optional, get_db
from app.models import User
from app.schemas import PostCreate, PostDetail, PostRead, PostUpdate
from app.services import posts as posts_service

router = APIRouter(prefix="/api/posts", tags=["posts"])
# Same resource (Post), different path root — GET /api/users/{id}/posts lives
# with the rest of the Post-listing logic rather than in the users router.
user_posts_router = APIRouter(prefix="/api/users", tags=["posts"])


@router.post("", response_model=PostRead, status_code=201)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.create_post(payload, db, current_user)


@router.get("", response_model=list[PostRead])
def list_posts(
    db: Session = Depends(get_db),
    city: str | None = None,
    min_fee: Decimal | None = Query(default=None, ge=0),
    max_fee: Decimal | None = Query(default=None, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return posts_service.list_posts(db, city, min_fee, max_fee, limit, offset)


@router.get("/{post_id}", response_model=PostDetail)
def get_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    return posts_service.get_post(post_id, db, current_user)


@router.put("/{post_id}", response_model=PostRead)
def update_post(
    post_id: uuid.UUID,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.update_post(post_id, payload, db, current_user)


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posts_service.delete_post(post_id, db, current_user)


@router.patch("/{post_id}/publish", response_model=PostRead)
def publish_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.publish_post(post_id, db, current_user)


@router.patch("/{post_id}/unpublish", response_model=PostRead)
def unpublish_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return posts_service.unpublish_post(post_id, db, current_user)


@user_posts_router.get("/{user_id}/posts", response_model=list[PostRead])
def list_user_posts(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    return posts_service.list_user_posts(user_id, db, current_user)
