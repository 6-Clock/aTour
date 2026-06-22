import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import ReviewCreate, ReviewRead
from app.services import reviews as reviews_service

router = APIRouter(prefix="/api/reviews", tags=["reviews"])
# The public list endpoints hang off post/user roots but share the review logic.
post_reviews_router = APIRouter(prefix="/api/posts", tags=["reviews"])
user_reviews_router = APIRouter(prefix="/api/users", tags=["reviews"])


@router.post("", response_model=ReviewRead, status_code=201)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reviews_service.create_review(payload, db, current_user)


@post_reviews_router.get("/{post_id}/reviews", response_model=list[ReviewRead])
def list_post_reviews(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return reviews_service.list_post_reviews(post_id, db, limit, offset)


@user_reviews_router.get("/{user_id}/reviews", response_model=list[ReviewRead])
def list_user_reviews(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return reviews_service.list_user_reviews(user_id, db, limit, offset)
