from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Community, Post, Tag, post_tags
from app.schemas import TagCount

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=List[TagCount])
def list_tags(
    community_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Distinct tags currently in use, most-used first -- this powers the
    "All / Programming / Politics / ..." filter row on community pages.
    Scoped to a community when `community_id` is given so the filter only
    ever shows tags that actually appear there.

    Global tags (no community given) must never leak community tags: the
    homepage filter row is a General-only feature, so the unscoped query
    defaults to the default community (resolved via is_default, never by
    name or hardcoded id).
    """
    query = (
        db.query(Tag.name, func.count(post_tags.c.post_id).label("post_count"))
        .join(post_tags, Tag.id == post_tags.c.tag_id)
        .join(Post, Post.id == post_tags.c.post_id)
    )
    if community_id:
        query = query.filter(Post.community_id == community_id)
    else:
        default_id = (
            db.query(Community.id)
            .filter(Community.is_default.is_(True))
            .scalar_subquery()
        )
        query = query.filter(Post.community_id == default_id)

    rows = (
        query.group_by(Tag.name)
        .order_by(func.count(post_tags.c.post_id).desc())
        .limit(limit)
        .all()
    )
    return [TagCount(name=name, post_count=count) for name, count in rows]
