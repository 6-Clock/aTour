import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import ImageReorderRequest, PostImageRead
from app.services import images as images_service

router = APIRouter(prefix="/api/posts", tags=["images"])


@router.post("/{post_id}/images", response_model=list[PostImageRead], status_code=201)
def add_image(
    post_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return images_service.add_image(post_id, file, db, current_user)


@router.get("/{post_id}/images", response_model=list[PostImageRead])
def list_images(post_id: uuid.UUID, db: Session = Depends(get_db)):
    return images_service.list_images(post_id, db)


# Declared before /{image_id} so PATCH .../images/reorder isn't parsed as an
# image_id (defensive — they differ by method, but keeps intent obvious).
@router.patch("/{post_id}/images/reorder", response_model=list[PostImageRead])
def reorder_images(
    post_id: uuid.UUID,
    payload: ImageReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return images_service.reorder_images(post_id, payload, db, current_user)


@router.delete("/{post_id}/images/{image_id}", status_code=204)
def delete_image(
    post_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    images_service.delete_image(post_id, image_id, db, current_user)
