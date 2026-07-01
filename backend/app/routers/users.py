import uuid

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import UserMe, UserPublic, UserUpdate
from app.services import users as users_service

router = APIRouter(prefix="/api/users", tags=["users"])


# IMPORTANT: the /me routes MUST be declared BEFORE /{user_id}. FastAPI matches
# in declaration order; with /{user_id} typed as uuid.UUID, a request to /me
# (or /me/photo) would otherwise try to parse "me" as a UUID and 422 before
# reaching these routes.
@router.get("/me", response_model=UserMe)
def read_me(current_user: User = Depends(get_current_user)):
    return users_service.get_me(current_user)


@router.put("/me", response_model=UserMe)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return users_service.update_me(payload, db, current_user)


@router.post("/me/photo", response_model=UserMe)
def upload_me_photo(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return users_service.upload_profile_photo(file, db, current_user)


@router.get("/{user_id}", response_model=UserPublic)
def read_public_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return users_service.get_public_profile(user_id, db)
