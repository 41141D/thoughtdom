from typing import Dict, Iterable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Vote


def batch_scores(db: Session, target_type: str, target_ids: Iterable[str]) -> Dict[str, int]:
    """Net vote score for every id in one query. Ids with no votes simply
    won't appear in the result -- callers should default missing keys to 0."""
    ids = list({t for t in target_ids if t})
    if not ids:
        return {}
    rows = (
        db.query(Vote.target_id, func.sum(Vote.value))
        .filter(Vote.target_type == target_type, Vote.target_id.in_(ids))
        .group_by(Vote.target_id)
        .all()
    )
    # target_id is stored as uuid in Postgres and reads back as a UUID
    # object, while comment/post ids are Python strings -- normalize to str
    # so caller dict lookups always hit.
    return {str(target_id): int(total or 0) for target_id, total in rows}


def batch_my_votes(
    db: Session, target_type: str, target_ids: Iterable[str], user_id: Optional[str]
) -> Dict[str, int]:
    """The viewer's own vote value for every id in one query. Empty dict if
    there's no signed-in viewer -- callers should default missing keys to None."""
    if not user_id:
        return {}
    ids = list({t for t in target_ids if t})
    if not ids:
        return {}
    rows = (
        db.query(Vote.target_id, Vote.value)
        .filter(
            Vote.target_type == target_type,
            Vote.target_id.in_(ids),
            Vote.user_id == user_id,
        )
        .all()
    )
    return {str(target_id): value for target_id, value in rows}


def score_for(db: Session, target_type: str, target_id: str) -> int:
    """Single-item convenience wrapper -- for the create endpoints, which
    only ever need one freshly-created row's score. Prefer batch_scores
    whenever scoring more than one item; calling this in a loop is exactly
    the N+1 pattern this module exists to avoid."""
    return batch_scores(db, target_type, [target_id]).get(target_id, 0)


def my_vote_for(db: Session, target_type: str, target_id: str, user_id: Optional[str]) -> Optional[int]:
    return batch_my_votes(db, target_type, [target_id], user_id).get(target_id)
