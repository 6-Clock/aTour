import uuid
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Post, User
from app.schemas import PostCreate, PostUpdate

MAX_POSTS_PER_USER = 5


# Ownership preamble shared by every write op (publish/unpublish/update/delete):
#
#   db.get(Post) ──None──► 404 (not found)
#        │
#     user_id != caller ──► 403 (not the owner)
#        │
#        └──► return Post (owned, safe to mutate)
def get_owned_post_or_404(
    post_id: uuid.UUID, db: Session, current_user: User
) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    if post.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="not the owner of this post")
    return post


def create_post(payload: PostCreate, db: Session, current_user: User) -> Post:
    # Max-5 enforced at the app layer (per data_table.md), not a DB constraint.
    # NOTE: count-then-insert has a narrow TOCTOU race under concurrent creates;
    # accepted at current scale — see TODOS.md.
    count = db.scalar(
        select(func.count()).select_from(Post).where(
            Post.user_id == current_user.user_id
        )
    )
    if count >= MAX_POSTS_PER_USER:
        raise HTTPException(status_code=409, detail="Maximum of 5 posts per user")

    post = Post(user_id=current_user.user_id, **payload.model_dump())
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail="invalid post data")
    db.refresh(post)
    return post


def get_post(post_id: uuid.UUID, db: Session, current_user: User | None) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    # Hidden posts are visible only to their owner; everyone else gets a 404 so
    # an unpublished post's existence isn't leaked. Ordered images come from the
    # Post.images relationship (serialized by PostDetail).
    is_owner = current_user is not None and current_user.user_id == post.user_id
    if not post.posted and not is_owner:
        raise HTTPException(status_code=404, detail="post not found")
    return post


def update_post(
    post_id: uuid.UUID, payload: PostUpdate, db: Session, current_user: User
) -> Post:
    post = get_owned_post_or_404(post_id, db, current_user)
    # exclude_unset => a partial edit never wipes fields the client didn't send.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return post


def delete_post(post_id: uuid.UUID, db: Session, current_user: User) -> None:
    post = get_owned_post_or_404(post_id, db, current_user)
    # Children (PostImage, Slot) cascade via DB-level ON DELETE CASCADE once
    # those tables exist (Tickets 5/6); none exist yet.
    db.delete(post)
    db.commit()


def publish_post(post_id: uuid.UUID, db: Session, current_user: User) -> Post:
    post = get_owned_post_or_404(post_id, db, current_user)
    post.posted = True
    db.commit()
    db.refresh(post)
    return post


def unpublish_post(post_id: uuid.UUID, db: Session, current_user: User) -> Post:
    post = get_owned_post_or_404(post_id, db, current_user)
    post.posted = False
    db.commit()
    db.refresh(post)
    return post


def list_posts(
    db: Session,
    city: str | None = None,
    min_fee: Decimal | None = None,
    max_fee: Decimal | None = None,
    title: str | None = None,
    location: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Post]:
    # Browse: published posts only. city lives on User (the guide), not Post, so
    # ?city joins Post -> User and filters User.city. title/location are plain
    # Post columns (no join) — case-insensitive substring match.
    stmt = select(Post).where(Post.posted.is_(True))
    if city is not None:
        stmt = stmt.join(User).where(User.city == city)
    if min_fee is not None:
        stmt = stmt.where(Post.booking_fee >= min_fee)
    if max_fee is not None:
        stmt = stmt.where(Post.booking_fee <= max_fee)
    if title is not None:
        stmt = stmt.where(Post.title.ilike(f"%{title}%"))
    if location is not None:
        stmt = stmt.where(Post.location.ilike(f"%{location}%"))
    # Eager-load images and the guide's User row — one extra query each for the
    # whole page, not one per post (covers cover_image_url and guide_name).
    stmt = (
        stmt.options(selectinload(Post.images), selectinload(Post.user))
        .order_by(Post.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(stmt).all()


def list_user_posts(
    user_id: uuid.UUID, db: Session, current_user: User | None
) -> list[Post]:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="user not found")
    is_owner = current_user is not None and current_user.user_id == user_id
    stmt = select(Post).where(Post.user_id == user_id)
    if not is_owner:
        stmt = stmt.where(Post.posted.is_(True))
    stmt = (
        stmt.options(selectinload(Post.images), selectinload(Post.user))
        .order_by(Post.created_at.desc())
    )
    return db.scalars(stmt).all()
