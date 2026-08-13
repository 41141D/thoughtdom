from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Vote, User, Report
from app.schemas import VoteRequest, ReportCreate
from app.services.rate_limit import enforce_rate_limit

router = APIRouter(tags=["votes"])


@router.post("/votes")
def cast_vote(
    payload: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(f"vote:{current_user.id}", settings.rate_limit_votes_per_min, 60, "voting")

    existing = (
        db.query(Vote)
        .filter(
            Vote.user_id == current_user.id,
            Vote.target_type == payload.target_type,
            Vote.target_id == payload.target_id,
        )
        .first()
    )

    if payload.value == 0:
        if existing:
            db.delete(existing)
            db.commit()
        return {"status": "removed"}

    if existing:
        existing.value = payload.value
    else:
        existing = Vote(
            user_id=current_user.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            value=payload.value,
        )
        db.add(existing)

    db.commit()
    return {"status": "ok", "value": payload.value}


@router.post("/reports")
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
    )
    db.add(report)
    db.commit()
    return {"status": "reported", "report_id": report.id}
