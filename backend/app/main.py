import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.database import SEED_USER_EMAIL, get_db
from app.models import Post, User
from app.schemas import PostCreate, PostRead

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == SEED_USER_EMAIL))
    if user is None:
        raise HTTPException(
            status_code=500,
            detail="seed user not found — run backend/scripts/seed.py",
        )
    return user


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
    except OperationalError:
        raise HTTPException(status_code=503, detail="database unreachable")
    return {"status": "ok"}


@app.post("/api/posts", response_model=PostRead, status_code=201)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = Post(user_id=current_user.user_id, **payload.model_dump())
    db.add(post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail="invalid post data")
    db.refresh(post)
    return post


@app.patch("/api/posts/{post_id}/publish", response_model=PostRead)
def publish_post(post_id: uuid.UUID, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    post.posted = True
    db.commit()
    db.refresh(post)
    return post


@app.get("/api/posts", response_model=list[PostRead])
def list_posts(db: Session = Depends(get_db)):
    return db.scalars(select(Post).where(Post.posted.is_(True))).all()
