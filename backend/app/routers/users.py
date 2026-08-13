from collections import Counter
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Comment, Community, Post, User
from app.schemas import ActivityItem, Milestone, TopicStat, UserProfileOut
from app.services.scoring import batch_scores

router = APIRouter(prefix="/users", tags=["users"])

# Reputation thresholds we celebrate. Undated -- we only know the current
# total, not when it was crossed, so these are shown as milestones reached
# rather than plotted on the dated timeline.
REPUTATION_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000]


def _excerpt(text: str, length: int = 140) -> str:
    text = text.strip().replace("\n", " ")
    return text if len(text) <= length else text[:length].rstrip() + "…"


@router.get("/{username}", response_model=UserProfileOut)
def get_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts: List[Post] = db.query(Post).filter(Post.author_id == user.id).all()
    comments: List[Comment] = db.query(Comment).filter(Comment.author_id == user.id).all()

    # Two grouped queries total (one per target type), regardless of how
    # many posts/comments this user has -- each score computed once here
    # and reused below, rather than re-queried per section as before.
    post_scores = batch_scores(db, "post", [p.id for p in posts])
    comment_scores = batch_scores(db, "comment", [c.id for c in comments])

    # ---- Reputation: sum of net vote score across everything they made ----
    reputation = sum(post_scores.values()) + sum(comment_scores.values())

    # ---- Helpful = net-positive reception ----
    helpful_posts = sum(1 for p in posts if post_scores.get(p.id, 0) > 0)
    helpful_comments = sum(1 for c in comments if comment_scores.get(c.id, 0) > 0)

    # ---- Communities participated in (posted or commented) ----
    community_ids = {p.community_id for p in posts}
    if comments:
        commented_post_ids = {c.post_id for c in comments}
        commented_posts = (
            db.query(Post).filter(Post.id.in_(commented_post_ids)).all() if commented_post_ids else []
        )
        community_ids |= {p.community_id for p in commented_posts}
    communities = [
        c.name for c in db.query(Community).filter(Community.id.in_(community_ids)).all()
    ] if community_ids else []

    # ---- Curiosity map: frequency of self-tagged topics on their posts ----
    topic_counter: Counter = Counter()
    for p in posts:
        if p.topics:
            for t in p.topics.split(","):
                t = t.strip().lower()
                if t:
                    topic_counter[t] += 1
    top_topics = topic_counter.most_common(8)
    max_count = top_topics[0][1] if top_topics else 1
    topics = [
        TopicStat(topic=t, count=n, weight=round(n / max_count, 2)) for t, n in top_topics
    ]

    # ---- Recent activity: posts + comments merged, most recent first ----
    activity: List[ActivityItem] = []
    for p in posts:
        activity.append(
            ActivityItem(
                type="post",
                id=p.id,
                post_id=p.id,
                title=p.title,
                excerpt=_excerpt(p.body),
                score=post_scores.get(p.id, 0),
                created_at=p.created_at,
            )
        )
    for c in comments:
        activity.append(
            ActivityItem(
                type="comment",
                id=c.id,
                post_id=c.post_id,
                title=None,
                excerpt=_excerpt(c.body),
                score=comment_scores.get(c.id, 0),
                created_at=c.created_at,
            )
        )
    activity.sort(key=lambda a: a.created_at, reverse=True)
    activity = activity[:15]

    # ---- Dated timeline: only events we can honestly attach a real date to.
    # Labels are stable translation keys (ui.profileTimeline.*) so the
    # frontend can render them in the viewer's locale instead of hardcoded
    # English strings.
    timeline: List[Milestone] = [Milestone(label="profileTimeline.joined", date=user.created_at)]
    if posts:
        first_post = min(posts, key=lambda p: p.created_at)
        timeline.append(Milestone(label="profileTimeline.firstPost", date=first_post.created_at))
    helpful_items = [p for p in posts if post_scores.get(p.id, 0) > 0] + [
        c for c in comments if comment_scores.get(c.id, 0) > 0
    ]
    if helpful_items:
        first_helpful = min(helpful_items, key=lambda x: x.created_at)
        timeline.append(
            Milestone(label="profileTimeline.firstHelpful", date=first_helpful.created_at)
        )
    timeline.sort(key=lambda m: m.date)

    # ---- Undated milestone strip: reputation thresholds actually crossed.
    # Keys carry the threshold value after a colon, e.g. reputationReached:10.
    reputation_milestones = [
        Milestone(label=f"profileTimeline.reputationReached:{t}", date=None)
        for t in REPUTATION_THRESHOLDS
        if reputation >= t
    ]

    return UserProfileOut(
        username=user.username,
        joined_at=user.created_at,
        reputation=reputation,
        helpful_posts=helpful_posts,
        helpful_comments=helpful_comments,
        communities=communities,
        topics=topics,
        recent_activity=activity,
        timeline=timeline,
        reputation_milestones=reputation_milestones,
    )
