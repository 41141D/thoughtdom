from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.database import get_db
from app.models import Community, Post, Tag, User
from app.schemas import PostCreate, PostOut
from app.services.authorization import require_community_member
from app.services.rate_limit import enforce_rate_limit
from app.services.scoring import batch_my_votes, batch_scores, my_vote_for, score_for

router = APIRouter(prefix="/posts", tags=["posts"])


def _to_post_out(post: Post, score: int, my_vote: Optional[int]) -> PostOut:
    return PostOut(
        id=post.id,
        author_username=post.author.username,
        community_id=post.community_id,
        community_name=post.community.name,
        title=post.title,
        body=post.body,
        topics=post.topics,
        tags=[t.name for t in post.tags],
        score=score,
        my_vote=my_vote,
        is_pinned=post.is_pinned,
        created_at=post.created_at,
    )


@router.get("/", response_model=List[PostOut])
def list_posts(
    community_id: str = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    # Product model: the global homepage feed is the public "general"
    # discussion -- community posts live inside their own rooms and must
    # never leak onto the homepage. The scope is resolved via is_default
    # (never hardcoded to a specific id or the name "general"), so a
    # renamed/re-seeded default community still works.
    # joinedload avoids an N+1: without it, accessing post.tags/post.community
    # below in _to_post_out fires one extra query per post.
    default_community = (
        db.query(Community).filter(Community.is_default.is_(True)).first()
    )
    default_id = default_community.id if default_community else None
    query = db.query(Post).options(joinedload(Post.tags), joinedload(Post.community))
    if community_id:
        # Explicit community filter requested by a caller (community page
        # and any future scoped consumers) -- scoped to that community's
        # room only, tag included.
        query = query.filter(Post.community_id == community_id)
    elif default_id:
        # No community filter -> global feed: General posts only.
        query = query.filter(Post.community_id == default_id)
    if tag:
        # Filtering by one tag today (per the feature spec); multi-tag
        # filtering later would swap this single .has() for a .any() over
        # a list plus an AND per tag, or a HAVING count() == len(tags).
        normalized_tag = tag.strip().lower()
        query = query.filter(Post.tags.any(Tag.name == normalized_tag))
    posts = query.order_by(Post.created_at.desc()).limit(100).all()

    # One grouped query for every post's score, one for the viewer's votes,
    # instead of two queries per post (was O(n), now O(1) query count).
    ids = [p.id for p in posts]
    viewer_id = viewer.id if viewer else None
    scores = batch_scores(db, "post", ids)
    my_votes = batch_my_votes(db, "post", ids, viewer_id)

    return [_to_post_out(p, scores.get(p.id, 0), my_votes.get(p.id)) for p in posts]


@router.get("/{post_id}", response_model=PostOut)
def get_post(
    post_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    post = (
        db.query(Post)
        .options(joinedload(Post.tags), joinedload(Post.community))
        .filter(Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    viewer_id = viewer.id if viewer else None
    return _to_post_out(post, score_for(db, "post", post.id), my_vote_for(db, "post", post.id, viewer_id))


@router.post("/", response_model=PostOut)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(
        f"post:{current_user.id}", settings.rate_limit_posts_per_min, 60, "creating posts"
    )

    community = db.query(Community).filter(Community.id == payload.community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    # The security boundary: posting into a community requires membership.
    # General (is_default) is always open to authenticated users -- the
    # helper returns immediately for it. Owner/moderator/member roles all
    # count as membership (CommunityMembership row exists); left, removed,
    # and banned users have no row (banned is already rejected by auth).
    # Pass the community id (not a transient Post): the helper resolves the
    # community row itself, which avoids the unloaded-relationship trap of
    # a freshly constructed Post whose `.community` is None.
    require_community_member(db, community.id, current_user)

    normalized_topics = None
    if payload.topics:
        parts = [t.strip() for t in payload.topics.split(",") if t.strip()]
        if parts:
            normalized_topics = ", ".join(parts[:6])  # cap so one post can't flood the topic list

    post = Post(
        author_id=current_user.id,
        topics=normalized_topics,
        community_id=payload.community_id,
        title=payload.title,
        body=payload.body,
        forked_from_post_id=payload.forked_from_post_id,
    )

    if payload.tags:  # already normalized/deduped/capped by PostCreate.normalize_tags
        post.tags = _get_or_create_tags(db, payload.tags)

    db.add(post)
    db.commit()
    db.refresh(post)
    return _to_post_out(post, 0, None)  # brand new post: no votes exist yet, skip the query entirely


def _get_or_create_tags(db: Session, names: List[str]) -> List[Tag]:
    """Resolve a list of already-normalized tag names to Tag rows, creating
    any that don't exist yet. One query for the existing rows instead of
    one SELECT per tag; new tags are added individually since SQLAlchemy
    needs each as its own pending object.
    """
    existing = db.query(Tag).filter(Tag.name.in_(names)).all()
    existing_by_name = {t.name: t for t in existing}

    tags: List[Tag] = []
    for name in names:
        tag = existing_by_name.get(name)
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            existing_by_name[name] = tag  # guards against dupes within this same call
        tags.append(tag)
    return tags
