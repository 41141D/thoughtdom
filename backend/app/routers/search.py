from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user_optional
from app.database import get_db
from app.models import Community, CommunityMembership, Post, Tag, User, Vote
from app.schemas import CommunityOut, PostOut
from app.services.scoring import batch_my_votes, batch_scores

router = APIRouter(prefix="/search", tags=["search"])

# Search limits: keep the query cheap and the results navigable. A 120-char
# cap keeps a pathological query string from ballooning the ILIKE plan, and
# pagination stops the result list from growing unboundedly.
MIN_QUERY_LENGTH = 1
MAX_QUERY_LENGTH = 120
DEFAULT_LIMIT = 20
MAX_LIMIT = 50
MAX_PAGE = 50


@router.get("/posts", response_model=List[PostOut])
def search_posts(
    q: str = Query(..., min_length=MIN_QUERY_LENGTH, max_length=MAX_QUERY_LENGTH),
    page: int = Query(1, ge=1, le=MAX_PAGE),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
):
    term = q.strip()
    if not term:
        raise HTTPException(status_code=422, detail="Search query must not be empty")

    # Split on whitespace and search the whole phrase plus the first three
    # tokens independently -- covers "how do I" style queries without a
    # full-text engine. Every token is lowercased for a case-insensitive
    # match against title and body.
    tokens = [t for t in term.split() if t][:3]
    patterns = [f"%{t.lower()}%" for t in tokens]
    phrase = f"%{term.lower()}%"

    title_cond = func.lower(Post.title).like(phrase)
    body_cond = func.lower(Post.body).like(phrase)
    for p in patterns:
        title_cond = title_cond | func.lower(Post.title).like(p)
        body_cond = body_cond | func.lower(Post.body).like(p)

    base = (
        db.query(Post)
        .options(joinedload(Post.tags), joinedload(Post.community), joinedload(Post.author))
        .filter(title_cond | body_cond)
    )

    # Scope mirrors the feed isolation rules: general posts are public
    # discovery (visible to logged-out visitors too); room posts surface
    # only to members of that room. A search box must never expose a
    # community room that the visibility model would otherwise gate.
    default_community = db.query(Community).filter(Community.is_default.is_(True)).first()
    default_id = default_community.id if default_community else None

    general_q = base.filter(Post.community_id == default_id) if default_id else base.filter(False)
    room_q = base.filter(Post.community_id != default_id)

    member_community_ids: List[str] = []
    viewer_id = viewer.id if viewer else None
    if viewer_id:
        member_community_ids = [
            m.community_id
            for m in db.query(CommunityMembership.community_id)
            .filter(CommunityMembership.user_id == viewer_id)
            .all()
        ]
        if member_community_ids:
            room_q = room_q.filter(Post.community_id.in_(member_community_ids))
        else:
            room_q = room_q.filter(False)

    visible = {p.id for p in general_q.all()} | {p.id for p in room_q.all()}
    if not visible:
        return []

    # Rebuild the ordered, paginated result from the visible id set. Two
    # queries (id set + ordered page) stay cheap because the id set is
    # computed by one grouped query, not per row.
    posts = (
        base
        .filter(Post.id.in_(visible))
        .order_by(Post.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    ids = [p.id for p in posts]
    scores = batch_scores(db, "post", ids)
    my_votes = batch_my_votes(db, "post", ids, viewer_id)

    return [
        PostOut(
            id=p.id,
            author_username=p.author.username,
            community_id=p.community_id,
            community_name=p.community.name,
            title=p.title,
            body=p.body,
            topics=p.topics,
            tags=[t.name for t in p.tags],
            score=scores.get(p.id, 0),
            my_vote=my_votes.get(p.id),
            is_pinned=p.is_pinned,
            created_at=p.created_at,
        )
        for p in posts
    ]


@router.get("/communities", response_model=List[CommunityOut])
def search_communities(
    q: str = Query(..., min_length=MIN_QUERY_LENGTH, max_length=MAX_QUERY_LENGTH),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    viewer: Optional[User] = Depends(get_current_user_optional),
):
    term = q.strip()
    if not term:
        raise HTTPException(status_code=422, detail="Search query must not be empty")

    # Community discovery is public -- names are already listed on the
    # /communities page, so search reveals nothing beyond that.
    communities = (
        db.query(Community)
        .options(joinedload(Community.creator))
        .filter(func.lower(Community.name).like(f"%{term.lower()}%"))
        .order_by(Community.is_default.desc(), func.lower(Community.name).asc())
        .limit(limit)
        .all()
    )

    viewer_id = viewer.id if viewer else None
    memberships = (
        db.query(CommunityMembership)
        .filter(
            CommunityMembership.user_id == viewer_id,
            CommunityMembership.community_id.in_([c.id for c in communities]),
        )
        .all()
    ) if viewer_id else []
    membership_by_community = {m.community_id: m for m in memberships}

    member_counts = dict(
        db.query(CommunityMembership.community_id, func.count(CommunityMembership.id))
        .filter(CommunityMembership.community_id.in_([c.id for c in communities]))
        .group_by(CommunityMembership.community_id)
        .all()
    )
    post_counts = dict(
        db.query(Post.community_id, func.count(Post.id))
        .filter(Post.community_id.in_([c.id for c in communities]))
        .group_by(Post.community_id)
        .all()
    )

    out = []
    for c in communities:
        m = membership_by_community.get(c.id)
        out.append(CommunityOut(
            id=c.id,
            name=c.name,
            description=c.description or "",
            creator_username=c.creator.username if c.creator else None,
            post_count=post_counts.get(c.id, 0),
            member_count=member_counts.get(c.id, 0),
            is_default=c.is_default,
            created_at=c.created_at,
            is_member=m is not None,
            role=m.role if m else None,
        ))
    return out
