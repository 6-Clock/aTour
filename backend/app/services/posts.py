import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Post, User
from app.schemas import PostCreate


def create_post(payload: PostCreate, db: Session, current_user: User) -> Post:
    post = Post(user_id=current_user.user_id, **payload.model_dump())
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail="invalid post data")
    db.refresh(post)
    return post


def publish_post(post_id: uuid.UUID, db: Session, current_user: User) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    if post.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="not the owner of this post")
    post.posted = True
    db.commit()
    db.refresh(post)
    return post


def list_published_posts(db: Session) -> list[Post]:
    return db.scalars(select(Post).where(Post.posted.is_(True))).all()
