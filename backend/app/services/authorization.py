"""Centralized community-participation authorization.

Product rule (one mental model):

    GENERAL -> public global discussion -> homepage -> everyone participates
    COMMUNITY -> separate room -> publicly viewable -> join to participate

Only one helper is needed because both posts and comments share the same
rule: the action is authorized against the post's community, and the default
(general) community is always open to authenticated users.

Usage:

    from app.services.authorization import require_community_member

    require_community_member(db, post, current_user)

Raises HTTPException(403) with a clear message when the caller is not a
member of the post's community. Never call this for read endpoints -- the
product model keeps community content publicly viewable.

Edge cases covered here (join/leave/remove/ban):

- Owner, moderators, and regular joined members are all members (a
  membership row with any role).
- A user who left, was removed by leadership, or had their join request
  rejected has NO membership row -> not a member.
- Banned accounts are already rejected at the JWT layer
  (app/auth.py returns 403 before any router runs), so this helper does
  not re-check User.is_banned.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Community, CommunityMembership, Post, User


def _is_community_member(
    db: Session, community: Community, user: User
) -> bool:
    if community.is_default:
        return True  # general is open to all authenticated users
    return (
        db.query(CommunityMembership.id)
        .filter(
            CommunityMembership.community_id == community.id,
            CommunityMembership.user_id == user.id,
        )
        .first()
        is not None
    )


def _resolve_community(db: Session, post_or_community_id) -> Community:
    """Resolve the community to authorize against. Accepts a Post object
    (uses its community relationship, loading the row when needed) or a raw
    community id string, so callers never hand-craft transient Post objects
    whose unloaded relationships blow up at runtime."""
    if isinstance(post_or_community_id, Post):
        post = post_or_community_id
        if post.community is not None:
            return post.community
        return (
            db.query(Community).filter(Community.id == post.community_id).one()
        )
    return db.query(Community).filter(Community.id == post_or_community_id).one()


def require_community_member(
    db: Session,
    post_or_community_id,
    user: User,
    action: str = "posting in",
) -> None:
    """Raise 403 unless `user` may participate in the given community.

    `post_or_community_id` is either a Post (the action is scoped to that
    post's community) or a community id. `action` is pasted into the error
    message (e.g. "posting in", "commenting on") so the same helper covers
    posts, comments, replies, and challenges without duplicate strings.
    """
    community = _resolve_community(db, post_or_community_id)
    if community.is_default:
        return  # general is open to all authenticated users
    if not _is_community_member(db, community, user):
        raise HTTPException(
            status_code=403,
            detail="You must join this community before "
            + action.rstrip()
            + " it.",
        )
