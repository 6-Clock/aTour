import os
import uuid
from urllib.parse import unquote, urlparse

from supabase import create_client, Client

BUCKET = "tour-images"
_client: Client | None = None


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
