import os
import uuid
from urllib.parse import unquote, urlparse

from fastapi import HTTPException
from supabase import create_client, Client

BUCKET = "tour-images"
_client: Client | None = None

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def validate_upload(file_bytes: bytes, content_type: str) -> None:
    """Server-side guard mirroring the client-side checks in ManageImages.tsx —
    those are UX-only and trivially bypassed by a direct authenticated request."""
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds 5MB limit")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="unsupported file type")


def _get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env"
            )
        _client = create_client(url, key)
    return _client


def upload_image(
    file_bytes: bytes, user_id: str, post_id: str, filename: str, content_type: str
) -> str:
    """Upload file bytes to Supabase Storage; returns the public URL."""
    client = _get_client()
    path = f"{user_id}/{post_id}/{uuid.uuid4()}-{filename}"
    client.storage.from_(BUCKET).upload(
        path, file_bytes, file_options={"content-type": content_type}
    )
    return client.storage.from_(BUCKET).get_public_url(path)


def delete_image(image_url: str) -> None:
    """Delete a file from Supabase Storage by its public URL.
    No-op when the URL doesn't match this bucket (e.g. external or test URLs)."""
    prefix = f"/storage/v1/object/public/{BUCKET}/"
    parsed = urlparse(image_url)
    if prefix not in parsed.path:
        return
    storage_path = unquote(parsed.path.split(prefix, 1)[1])
    _get_client().storage.from_(BUCKET).remove([storage_path])
