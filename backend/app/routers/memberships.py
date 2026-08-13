from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.database import get_db
from app.models import Community, CommunityMembership, MembershipRequest, User
from app.schemas import CommunitySettingsUpdate, MembershipAction, MembershipOut

router = APIRouter(prefix="/communities", tags=["communities"])


# ---------------------------------------------------------------- helpers
def _resolve_community(db: Session, id_or_name: str) -> Community:
    if len(id_or_name) == 36 and not id_or_name.startswith(("com", "gen")):
        c = db.query(Community).filter(Community.id == id_or_name).first()
        if c:
            return c
    c = db.query(Community).filter(func.lower(Community.name) == id_or_name.lower()).first()
    if c:
        return c
    raise HTTPException(status_code=404, detail="Community not found")


def _get_membership(db: Session, community: Community, user: User) -> Optional[CommunityMembership]:
    return (
        db.query(CommunityMembership)
        .filter(CommunityMembership.community_id == community.id, CommunityMembership.user_id == user.id)
        .first()
    )


def _require_leadership(db: Session, community: Community, user: User,
                        allowed_roles: tuple = ("owner",)) -> CommunityMembership:
    """Return the caller's membership only if they hold a leadership role.
    Owner and moderators can both moderate; only owners manage roles and
    settings. `general` has no membership rows at all, so nobody leads it."""
    if community.is_default:
        raise HTTPException(
            status_code=403,
            detail="The general community is public and has no leader -- "
                   "everyone participates in it directly.",
        )
    m = _get_membership(db, community, user)
    if not m or m.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Community leadership required")
    return m


def _to_membership_out(m: CommunityMembership) -> MembershipOut:
    return MembershipOut(
        id=m.id,
        community_id=m.community_id,
        username=m.user.username,
        role=m.role,
        created_at=m.created_at,
    )


def _is_member(db: Session, community: Community, user: User) -> bool:
    if community.is_default:
        return True  # general is open to everyone
    return _get_membership(db, community, user) is not None


# ---------------------------------------------------------------- members
@router.get("/{id_or_name}/members", response_model=List[MembershipOut])
def list_members(
    id_or_name: str,
    db: Session = Depends(get_db),
):
    """Roster for a community. Anyone can view it -- leadership is about
    moderation, not secrecy."""
    community = _resolve_community(db, id_or_name)
    memberships = (
        db.query(CommunityMembership)
        .filter(CommunityMembership.community_id == community.id)
        .order_by(
            CommunityMembership.role.asc(),
            CommunityMembership.created_at.asc(),
        )
        .all()
    )
    return [_to_membership_out(m) for m in memberships]


@router.post("/{id_or_name}/join")
def join_community(
    id_or_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join a community. `general` needs no action (always public); every
    other community holds join requests that the owner must approve."""
    community = _resolve_community(db, id_or_name)
    if community.is_default:
        return {"detail": "Already a member -- the general community is open to everyone."}
    if _get_membership(db, community, current_user):
        raise HTTPException(status_code=400, detail="You are already a member")

    pending = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.community_id == community.id,
            MembershipRequest.user_id == current_user.id,
            MembershipRequest.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=400, detail="A join request is already pending -- the owner will review it soon.")

    request = MembershipRequest(community_id=community.id, user_id=current_user.id)
    db.add(request)
    db.commit()
    return {"detail": "Join request sent to the community owner for approval."}


@router.post("/{id_or_name}/leave")
def leave_community(
    id_or_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a community (or withdraw a pending join request)."""
    community = _resolve_community(db, id_or_name)
    if community.is_default:
        raise HTTPException(status_code=400, detail="The general community has no membership to leave.")

    m = _get_membership(db, community, current_user)
    if m:
        db.delete(m)
        db.commit()
        return {"detail": "You left the community."}

    pending = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.community_id == community.id,
            MembershipRequest.user_id == current_user.id,
            MembershipRequest.status == "pending",
        )
        .first()
    )
    if pending:
        db.delete(pending)
        db.commit()
        return {"detail": "Join request withdrawn."}

    raise HTTPException(status_code=404, detail="Not a member and no pending request.")


@router.get("/{id_or_name}/membership")
def my_membership(
    id_or_name: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """The caller's role in this community, or a pending-request status.
    Unauthenticated viewers and non-members get a 404-like null response."""
    community = _resolve_community(db, id_or_name)
    if not viewer:
        return None
    if community.is_default:
        return {"is_member": True, "role": "member", "is_general": True}
    m = _get_membership(db, community, viewer)
    if m:
        return {"is_member": True, "role": m.role, "is_general": False}
    pending = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.community_id == community.id,
            MembershipRequest.user_id == viewer.id,
            MembershipRequest.status == "pending",
        )
        .first()
    )
    if pending:
        return {"is_member": False, "role": None, "pending_request": True, "is_general": False}
    return {"is_member": False, "role": None, "pending_request": False, "is_general": False}


# ------------------------------------------------------------- leadership
@router.get("/{id_or_name}/requests")
def list_join_requests(
    id_or_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pending join requests -- owners decide who gets in."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user)
    requests = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.community_id == community.id,
            MembershipRequest.status == "pending",
        )
        .order_by(MembershipRequest.created_at.asc())
        .all()
    )
    return [{"id": r.id, "username": r.user.username, "requested_at": r.created_at} for r in requests]


@router.post("/{id_or_name}/requests/{request_id}/approve")
def approve_request(
    id_or_name: str,
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a join request: the requester becomes a member. Only the
    owner decides -- approving grants ordinary membership, not leadership."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user)

    request = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.id == request_id,
            MembershipRequest.community_id == community.id,
            MembershipRequest.status == "pending",
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Pending request not found")

    # Guard against a race where the user somehow gained membership already.
    if _get_membership(db, community, request.user):
        request.status = "approved"
        db.commit()
        return {"detail": "Member already present -- request marked approved."}

    db.add(CommunityMembership(community_id=community.id, user_id=request.user.id, role="member"))
    request.status = "approved"
    db.commit()
    return {"detail": f"{request.user.username} is now a member."}


@router.post("/{id_or_name}/requests/{request_id}/reject")
def reject_request(
    id_or_name: str,
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user)
    request = (
        db.query(MembershipRequest)
        .filter(
            MembershipRequest.id == request_id,
            MembershipRequest.community_id == community.id,
            MembershipRequest.status == "pending",
        )
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Pending request not found")
    request.status = "rejected"
    db.commit()
    return {"detail": "Join request rejected."}


@router.put("/{id_or_name}/members/{username}")
def set_member_role(
    id_or_name: str,
    username: str,
    payload: MembershipAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Promote/demote a member (moderator <-> member). Only owners can
    change roles, and a second owner row is never created -- the creator
    stays the single owner."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user, allowed_roles=("owner",))

    target = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    m = _get_membership(db, community, target)
    if not m:
        raise HTTPException(status_code=404, detail="User is not a member")
    if m.role == "owner":
        raise HTTPException(status_code=400, detail="The owner role cannot be changed -- the creator stays the leader.")

    new_role = payload.role or "member"
    if m.role == new_role:
        raise HTTPException(status_code=400, detail="Member already has that role")

    m.role = new_role
    db.commit()
    return {"detail": f"{target.username} is now a {new_role}."}


@router.delete("/{id_or_name}/members/{username}")
def remove_member(
    id_or_name: str,
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove (or ban-reject) a member. Owner and moderators can do this;
    owners cannot be removed by anyone. A removed user's past posts and
    comments stay -- moderation is about membership, not erasure."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user, allowed_roles=("owner", "moderator"))

    target = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Use the leave flow to exit a community.")

    m = _get_membership(db, community, target)
    if not m:
        raise HTTPException(status_code=404, detail="User is not a member")
    if m.role == "owner":
        raise HTTPException(status_code=403, detail="The owner cannot be removed from their own community.")

    db.delete(m)
    # A removed member's pending join request (if resubmitted) would go
    # through the normal approval flow -- removal isn't a permanent ban,
    # but re-entry requires the owner's sign-off again.
    db.commit()
    return {"detail": f"{target.username} was removed from the community."}


@router.patch("/{id_or_name}/settings")
def update_community_settings(
    id_or_name: str,
    payload: CommunitySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner-only settings. Keeps the scope minimal (description today) --
    renaming would break saved URLs, and the name is the identity."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user, allowed_roles=("owner",))

    if payload.description is not None:
        community.description = payload.description
    db.commit()
    return {"detail": "Community settings updated."}


@router.get("/{id_or_name}/reports", response_model=list)
def list_community_reports(
    id_or_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pending reports against posts/comments in this community, visible to
    owner and moderators so the community can moderate its own content."""
    community = _resolve_community(db, id_or_name)
    _require_leadership(db, community, current_user, allowed_roles=("owner", "moderator"))

    from app.models import Post, Comment, Report

    community_post_ids = [p.id for p in db.query(Post.id).filter(Post.community_id == community.id).all()]
    if not community_post_ids:
        return []
    reports = (
        db.query(Report)
        .filter(
            Report.status == "pending",
            Report.target_type == "post",
            Report.target_id.in_(community_post_ids),
        )
        .order_by(Report.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": r.id,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "reason": r.reason,
            "reported_by": r.reporter.username,
            "created_at": r.created_at,
        }
        for r in reports
    ]
