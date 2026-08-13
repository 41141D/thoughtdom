"""
Minimal Supabase Storage client, used only for the `post-images` bucket.

Deliberately not the full `supabase` SDK -- we only need one operation
(upload bytes, get a public URL), so a couple of direct REST calls via
httpx keep the dependency footprint small and avoid pulling in the SDK's
auth/realtime/postgrest clients we don't use.

Auth: Supabase Storage's REST API accepts the service_role key as a
bearer token for server-side (trusted) uploads. This key must never reach
the frontend -- see SUPABASE_SERVICE_ROLE_KEY in backend/.env.example.
"""

import httpx

from app.config import settings

BUCKET = "post-images"


def upload_bytes(path: str, data: bytes, content_type: str) -> str:
    """Upload `data` to `post-images/{path}` (upserting if it already
    exists) and return its public URL.

    Raises httpx.HTTPStatusError if the upload fails -- callers should let
    that surface as a 502/500 rather than silently swallowing it, since a
    failed upload must not result in a MediaAsset row pointing at nothing.
    """
    url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = httpx.post(url, headers=headers, content=data, timeout=30)
    resp.raise_for_status()
    return public_url(path)


def public_url(path: str) -> str:
    return f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{path}"
