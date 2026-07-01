import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models import Post, PostImage, User
from app.schemas import ImageReorderRequest
from app.services import storage
from app.services.posts import get_owned_post_or_404


def add_image(
    post_id: uuid.UUID, file: UploadFile, db: Session, current_user: User
) -> list[PostImage]:
    post = get_owned_post_or_404(post_id, db, current_user)
    file_bytes = file.file.read()
    storage.validate_upload(file_bytes, file.content_type or "")
    image_url = storage.upload_image(
        file_bytes,
        str(current_user.user_id),
        str(post_id),
        file.filename or "image",
        file.content_type or "image/jpeg",
    )
    start = max((img.display_order for img in post.images), default=-1) + 1
    db.add(PostImage(post_id=post.post_id, image_url=image_url, display_order=start))
    db.commit()
    db.refresh(post)
    return post.images


def list_images(post_id: uuid.UUID, db: Session) -> list[PostImage]:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    return post.images  # relationship is ordered by display_order


def delete_image(
    post_id: uuid.UUID, image_id: uuid.UUID, db: Session, current_user: User
) -> None:
    get_owned_post_or_404(post_id, db, current_user)  # ownership gate
    image = db.get(PostImage, image_id)
    if image is None or image.post_id != post_id:
        raise HTTPException(status_code=404, detail="image not found")
    image_url = image.image_url
    db.delete(image)
    db.commit()
    storage.delete_image(image_url)


def reorder_images(
    post_id: uuid.UUID,
    payload: ImageReorderRequest,
    db: Session,
    current_user: User,
) -> list[PostImage]:
    post = get_owned_post_or_404(post_id, db, current_user)
    current_ids = {img.image_id for img in post.images}
    submitted = payload.image_ids
    # Strict: the submitted set must be exactly the post's current images — no
    # foreign ids, no duplicates, none missing. Partial reorders are ambiguous.
    if set(submitted) != current_ids or len(submitted) != len(current_ids):
        raise HTTPException(
            status_code=400,
            detail="image_ids must be exactly the post's current images",
        )
    order = {image_id: idx for idx, image_id in enumerate(submitted)}
    for img in post.images:
        img.display_order = order[img.image_id]
    db.commit()
    db.refresh(post)
    return post.images
