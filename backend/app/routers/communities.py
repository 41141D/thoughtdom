from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.models import Community, CommunityMembership, Post, Tag, User
from app.schemas import CommunityCreate, CommunityOut, PostOut
from app.services.scoring import batch_my_votes, batch_scores

router = APIRouter(prefix="/communities", tags=["communities"])


def _to_community_out(community: Community, post_count: int) -> CommunityOut:
    return CommunityOut(
        id=community.id,
        name=community.name,
        description=community.description or "",
        creator_username=community.creator.username if community.creator else None,
        post_count=post_count,
        is_default=community.is_default,
        created_at=community.created_at,
    )


def _resolve_community(db: Session, id_or_name: str) -> Community:
    """Community pages/API calls are addressed by either the DB id or the
    name (which doubles as the URL slug, e.g. /community/programming).
    Try the id first since it's an indexed exact match either way; falling
    through to a case-insensitive name lookup is what makes /community/general
    and /community/General resolve the same row."""
    community = db.query(Community).filter(Community.id == id_or_name).first()
    if not community:
        community = (
            db.query(Community).filter(func.lower(Community.name) == id_or_name.lower()).first()
        )
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


@router.get("/", response_model=List[CommunityOut])
def list_communities(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    # One grouped query for post counts instead of one COUNT(*) per
    # community -- same N+1-avoidance pattern used for post scores.
    post_counts = dict(
        db.query(Post.community_id, func.count(Post.id)).group_by(Post.community_id).all()
    )
    member_counts = dict(
        db.query(CommunityMembership.community_id, func.count(CommunityMembership.id))
        .group_by(CommunityMembership.community_id)
        .all()
    )
    communities = (
        db.query(Community)
        .options(joinedload(Community.creator))
        # General first, then oldest-first, so it's always the default
        # selection in the "new post" community dropdown.
        .order_by(Community.is_default.desc(), Community.created_at.asc())
        .all()
    )

    # The viewer's own membership per community -- powering the "Your
    # communities" section on the Communities page. General stays open to
    # everyone, so it has no membership row and stays is_member=None.
    memberships = {}
    if viewer:
        memberships = {
            m.community_id: m
            for m in db.query(CommunityMembership)
            .filter(CommunityMembership.user_id == viewer.id)
            .all()
        }

    out = []
    for c in communities:
        m = memberships.get(c.id)
        co = _to_community_out(c, post_counts.get(c.id, 0))
        co.member_count = member_counts.get(c.id, 0)
        co.is_member = m is not None
        co.role = m.role if m else None
        out.append(co)
    return out


@router.post("/", response_model=CommunityOut)
def create_community(
    payload: CommunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Community).filter(func.lower(Community.name) == payload.name.lower()).first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A community with that name already exists")

    community = Community(
        name=payload.name,
        description=payload.description,
        creator_id=current_user.id,
        is_default=False,
    )
    db.add(community)
    db.flush()  # need community.id before the membership row can reference it

    db.add(CommunityMembership(community_id=community.id, user_id=current_user.id, role="owner"))
    db.commit()
    db.refresh(community)
    return _to_community_out(community, 0)


@router.get("/{id_or_name}", response_model=CommunityOut)
def get_community(
    id_or_name: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    community = _resolve_community(db, id_or_name)
    post_count = db.query(func.count(Post.id)).filter(Post.community_id == community.id).scalar()
    member_count = (
        db.query(func.count(CommunityMembership.id))
        .filter(CommunityMembership.community_id == community.id)
        .scalar()
    )
    # Ownership visibility on the community page header -- the membership
    # endpoint already carries the viewer's role; listing it on the
    # community itself means logged-out visitors still see a real member
    # count.
    co = _to_community_out(community, post_count or 0)
    co.member_count = member_count or 0
    if viewer:
        m = (
            db.query(CommunityMembership)
            .filter(
                CommunityMembership.community_id == community.id,
                CommunityMembership.user_id == viewer.id,
            )
            .first()
        )
        co.is_member = m is not None
        co.role = m.role if m else None
    return co


@router.get("/{id_or_name}/posts", response_model=List[PostOut])
def list_community_posts(
    id_or_name: str,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    community = _resolve_community(db, id_or_name)

    query = (
        db.query(Post)
        .options(joinedload(Post.tags), joinedload(Post.community), joinedload(Post.author))
        .filter(Post.community_id == community.id)
    )
    if tag:
        normalized_tag = tag.strip().lower()
        query = query.filter(Post.tags.any(Tag.name == normalized_tag))
    posts = query.order_by(Post.created_at.desc()).limit(100).all()

    ids = [p.id for p in posts]
    viewer_id = viewer.id if viewer else None
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
