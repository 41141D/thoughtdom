from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_optional
from app.config import settings
from app.database import get_db
from app.models import Comment, Post, User
from app.schemas import CommentCreate, CommentOut, SteelmanRevise
from app.services.authorization import require_community_member
from app.services.rate_limit import enforce_rate_limit
from app.services.scoring import batch_my_votes, batch_scores
from app.services.steelman import evaluate_steelman

router = APIRouter(prefix="/comments", tags=["comments"])


def _to_comment_out(comment: Comment, score: int, my_vote: Optional[int],
                    feedback: str | None = None) -> CommentOut:
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        parent_comment_id=comment.parent_comment_id,
        author_username=comment.author.username,
        reply_type=comment.reply_type,
        steelman_text=comment.steelman_text,
        steelman_passed=comment.steelman_passed,
        steelman_status=comment.steelman_status,
        steelman_feedback=comment.steelman_feedback if feedback is None else feedback,
        body=comment.body,
        score=score,
        my_vote=my_vote,
        created_at=comment.created_at,
    )


@router.get("/post/{post_id}", response_model=List[CommentOut])
def list_comments(
    post_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """List comments on a post. A challenge comment whose gate verdict is
    not "passed" is only visible to its author (they can revise it); other
    viewers never see failed or pending challenges, so the public thread
    only contains challenges that engaged in good faith."""
    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    viewer_id = viewer.id if viewer else None
    visible: List[Comment] = []
    for c in comments:
        if c.reply_type == "challenge" and c.steelman_status != "passed":
            # Held attempts are private to their author.
            if not viewer or viewer.id != c.author_id:
                continue
        visible.append(c)

    ids = [c.id for c in visible]
    scores = batch_scores(db, "comment", ids)
    my_votes = batch_my_votes(db, "comment", ids, viewer_id)
    return [_to_comment_out(c, scores.get(c.id, 0), my_votes.get(c.id)) for c in visible]


def _gate(original_text: str, restatement: str) -> tuple[str, float, str]:
    """Run the three-outcome Steel-Man Gate and record the good-faith
    attempt on the user. Returns (verdict, score, feedback)."""
    verdict, score, feedback = evaluate_steelman(
        original_text, restatement, settings.steelman_min_similarity
    )
    return verdict, score, feedback


@router.post("/", response_model=CommentOut)
def create_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enforce_rate_limit(
        f"comment:{current_user.id}", settings.rate_limit_comments_per_min, 60, "commenting"
    )

    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Reading community threads is public; participating in one
    # (commenting, replying, or challenging) requires membership in the
    # post's community. The default (general) community is open to all
    # authenticated users -- the helper returns immediately for it.
    require_community_member(db, post, current_user, "commenting on")

    steelman_status: Optional[str] = None
    steelman_passed: Optional[bool] = None
    steelman_feedback: Optional[str] = None

    if payload.reply_type == "challenge":
        # The Steel-Man Gate: what is being restated is either the parent
        # comment's body (if replying to a comment) or the post's body.
        if payload.parent_comment_id:
            parent = db.query(Comment).filter(Comment.id == payload.parent_comment_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent comment not found")
            original_text = parent.body
        else:
            original_text = f"{post.title}\n{post.body}"

        verdict, score, feedback = _gate(original_text, payload.steelman_text or "")
        steelman_status = verdict
        steelman_passed = verdict == "passed"
        steelman_feedback = feedback

        current_user.good_faith_attempts = (current_user.good_faith_attempts or 0) + 1
        if steelman_passed:
            current_user.good_faith_score = (current_user.good_faith_score or 0) + 1

    comment = Comment(
        post_id=payload.post_id,
        parent_comment_id=payload.parent_comment_id,
        author_id=current_user.id,
        reply_type=payload.reply_type,
        steelman_text=payload.steelman_text,
        steelman_passed=steelman_passed,
        steelman_status=steelman_status,
        steelman_feedback=steelman_feedback,
        body=payload.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # A verdict of needs_improvement or failed is NOT an HTTP error -- the
    # comment is stored (privately, pending revision) and the response
    # carries the verdict + feedback so the client can offer a revise flow
    # instead of a dead-end error message.
    return _to_comment_out(comment, 0, None)


@router.patch("/{comment_id}/steelman", response_model=CommentOut)
def revise_steelman(
    comment_id: str,
    payload: SteelmanRevise,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-attempt the steelman_text of a challenge comment the caller owns
    that is currently held at needs_improvement (or failed). Failing again
    returns the new verdict + feedback; passing publishes the comment."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    if comment.reply_type != "challenge":
        raise HTTPException(status_code=400, detail="Only challenge comments go through the gate")

    post = db.query(Post).filter(Post.id == comment.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if comment.parent_comment_id:
        parent = db.query(Comment).filter(Comment.id == comment.parent_comment_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        original_text = parent.body
    else:
        original_text = f"{post.title}\n{post.body}"

    verdict, score, feedback = _gate(original_text, payload.steelman_text)
    comment.steelman_text = payload.steelman_text
    comment.steelman_passed = verdict == "passed"
    comment.steelman_status = verdict
    comment.steelman_feedback = feedback

    current_user.good_faith_attempts = (current_user.good_faith_attempts or 0) + 1
    if verdict == "passed":
        current_user.good_faith_score = (current_user.good_faith_score or 0) + 1

    db.commit()
    db.refresh(comment)
    return _to_comment_out(comment, 0, None)
