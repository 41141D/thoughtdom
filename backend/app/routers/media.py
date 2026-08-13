import io
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import MediaAsset, User
from app.schemas import MediaAssetOut
from app.services.rate_limit import enforce_rate_limit
from app.services import supabase_storage

router = APIRouter(prefix="/media", tags=["media"])

ACCEPTED_FORMATS = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}
CONTENT_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


def _encode(img: Image.Image, fmt: str, quality: int = 85) -> bytes:
    """Encode `img` to bytes in memory (was: write to a local path). Same
    quality/optimize behavior as before -- only the destination changed."""
    save_kwargs = {"quality": quality, "optimize": True} if fmt in ("JPEG", "WEBP") else {"optimize": True}
    if fmt == "JPEG" and img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


@router.post("/image", response_model=MediaAssetOut)
def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(
        f"upload:{current_user.id}", settings.rate_limit_uploads_per_min, 60, "uploading images"
    )

    raw = file.file.read()
    if len(raw) > 20 * 1024 * 1024:  # hard ceiling before we even try to decode
        raise HTTPException(status_code=413, detail="File too large")

    # Never trust the client's declared content-type: decode the actual
    # bytes. This both validates it's a real image and, because we re-encode
    # from the decoded pixel data below, strips anything smuggled in the
    # original file outside the image data itself.
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="File is not a valid image")

    if img.format not in ACCEPTED_FORMATS:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, and WEBP images are accepted")

    # Storage is always WebP -- a free-tier Supabase database has only 1GB of
    # storage, and a single phone photo can be 3-5MB as JPEG or more as PNG.
    # WebP at the same visual quality is typically 60-80% smaller, so the 1GB
    # ceiling holds thousands of posts instead of a few hundred. The original
    # format is still validated above (real-image check); only the stored
    # representation changes. Display semantics are identical because browsers
    # render WebP natively everywhere that matters since 2020.
    fmt = "WEBP"
    ext = "webp"

    # Resize to the max long-edge dimension, preserving aspect ratio.
    w, h = img.size
    longest = max(w, h)
    if longest > settings.max_image_dimension:
        scale = settings.max_image_dimension / longest
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)

    asset_id = str(uuid.uuid4())
    content_type = "image/webp"

    # Compress down under the size cap, stepping quality down if needed.
    quality = 80
    full_bytes = _encode(img, fmt, quality)
    while len(full_bytes) > settings.max_image_bytes and quality > 35:
        quality -= 15
        full_bytes = _encode(img, fmt, quality)

    if len(full_bytes) > settings.max_image_bytes:
        raise HTTPException(status_code=413, detail="Image is too large even after compression")

    thumb = img.copy()
    tw, th = thumb.size
    tlongest = max(tw, th)
    if tlongest > settings.thumbnail_dimension:
        scale = settings.thumbnail_dimension / tlongest
        thumb = thumb.resize((max(1, int(tw * scale)), max(1, int(th * scale))), Image.LANCZOS)
    thumb_bytes = _encode(thumb, fmt, quality=75)

    byte_size = len(full_bytes)

    # Supabase-first, local fallback. Uploads route to Supabase Storage only
    # when BOTH credentials are configured (see config.is_supabase_configured);
    # otherwise they save to the local upload dir, which main.py mounts at
    # /media/uploads -- the same contract as before, so nothing upstream
    # (MediaAsset rows, post markdown, the API response) needs to know.
    if settings.supabase_url and settings.supabase_service_role_key:
        try:
            url = supabase_storage.upload_bytes(f"{asset_id}.{ext}", full_bytes, content_type)
            thumbnail_url = supabase_storage.upload_bytes(
                f"{asset_id}_thumb.{ext}", thumb_bytes, content_type
            )
        except httpx.HTTPStatusError as e:
            # Storage bucket missing or misconfigured: the upload must never
            # succeed with a URL pointing at nothing. Log and fail loudly so
            # the problem shows up instead of broken image links.
            import logging

            logging.getLogger(__name__).error(
                "Supabase upload failed (%s) -- check the post-images bucket "
                "and credentials", e.response.status_code
            )
            raise HTTPException(
                status_code=502,
                detail="Image storage is unavailable. Please try again later.",
            )
    else:
        # Local fallback: deterministic filename so retries are idempotent,
        # served by the StaticFiles mount at /media/uploads.
        fname = f"{asset_id}.{ext}"
        full_path = os.path.join(settings.upload_dir, fname)
        thumb_fname = f"{asset_id}_thumb.{ext}"
        thumb_path = os.path.join(settings.upload_dir, thumb_fname)
        with open(full_path, "wb") as f:
            f.write(full_bytes)
        with open(thumb_path, "wb") as f:
            f.write(thumb_bytes)
        url = f"/media/uploads/{fname}"
        thumbnail_url = f"/media/uploads/{thumb_fname}"

    asset = MediaAsset(
        id=asset_id,
        author_id=current_user.id,
        kind="image",
        url=url,
        thumbnail_url=thumbnail_url,
        width=img.width,
        height=img.height,
        byte_size=byte_size,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
