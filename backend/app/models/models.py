import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String(32), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    reputation_score = Column(Integer, default=0)
    good_faith_score = Column(Integer, default=0)  # Steel-Man Gate reputation
    good_faith_attempts = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    is_banned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)

    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")


class Community(Base):
    __tablename__ = "communities"

    id = Column(String, primary_key=True, default=gen_uuid)
    # Doubles as the URL slug (/community/<name>) -- kept lowercase and
    # restricted to [a-z0-9_-] at the API layer, so no separate slug column
    # is needed. unique=True is also what backs the duplicate-name check.
    name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    # Nullable because the seeded "general" community has no creator.
    creator_id = Column(String, ForeignKey("users.id"), nullable=True)
    # True only for "general". Used instead of a name == "general" check so
    # the protected-community rule doesn't silently break if it's ever
    # renamed or re-seeded under a different string.
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now)

    posts = relationship("Post", back_populates="community")
    creator = relationship("User", foreign_keys=[creator_id])
    memberships = relationship(
        "CommunityMembership", back_populates="community", cascade="all, delete-orphan"
    )


class CommunityMembership(Base):
    """A user's relationship to a community. Today this only ever stores the
    single "owner" row created at community creation time, but modeling it
    as its own table (rather than a `communities.owner_id` column) is what
    lets moderators, regular members, and join/leave later reuse this same
    table with a new `role` value or additional rows -- no schema redesign
    needed, just new rows.
    """

    __tablename__ = "community_memberships"
    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_member"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    community_id = Column(String, ForeignKey("communities.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    # owner | moderator | member (only "owner" is ever written today)
    role = Column(String(16), nullable=False, default="owner")
    created_at = Column(DateTime, default=now)

    community = relationship("Community", back_populates="memberships")
    user = relationship("User")


# Post <-> Tag is many-to-many: a post can carry up to 5 tags (enforced in
# the API layer, not the DB), and a tag (e.g. "programming") is shared
# across every post that uses it. Plain association table, not a mapped
# class, since the relationship itself carries no extra data (no "added_by",
# no timestamp) -- just membership. Composite PK doubles as the uniqueness
# guard against a post being tagged with the same tag twice.
post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", String, ForeignKey("posts.id"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.id"), primary_key=True),
)


class MembershipRequest(Base):
    """A user's request to join a community whose owner must approve it.
    The `general` default community is public -- it never holds requests or
    membership rows (everyone is a member by default). One pending request
    per user per community is enforced at the API layer; the composite
    unique index covers the full lifecycle (a rejected request can be
    resubmitted, hence status in the constraint).
    """
    __tablename__ = "membership_requests"
    __table_args__ = (
        UniqueConstraint("community_id", "user_id", "status", name="uq_membership_request"),
    )
    id = Column(String, primary_key=True, default=gen_uuid)
    community_id = Column(String, ForeignKey("communities.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    # pending | approved | rejected -- only "pending" rows block joins
    status = Column(String(12), nullable=False, default="pending")
    created_at = Column(DateTime, default=now)
    community = relationship("Community")
    user = relationship("User")


class Tag(Base):
    """A normalized topic label posts can be filed under for discovery.

    `name` is always stored lowercase/trimmed (normalization happens in the
    API layer on write) so "Python", "python", and " python " all resolve
    to one row -- this is what makes the tag filter and duplicate-tag
    rejection work without doing case-insensitive comparisons everywhere.
    """

    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(30), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=now)

    posts = relationship("Post", secondary=post_tags, back_populates="tags")


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, default=gen_uuid)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    community_id = Column(String, ForeignKey("communities.id"), nullable=False)
    forked_from_post_id = Column(String, ForeignKey("posts.id"), nullable=True)
    title = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    # Free-text, comma-separated topics the author tags their own post with
    # (e.g. "artificial intelligence, biology"). Deliberately not a separate
    # table yet -- this is a minimal seed so profile Curiosity Maps have real
    # data, not a full taxonomy. Upgrade path: normalize into a Tag model
    # + join table once tagging becomes a first-class feature.
    topics = Column(String(300), nullable=True)
    is_pinned = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, nullable=True)

    author = relationship("User", back_populates="posts")
    community = relationship("Community", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    # The formal tagging system (up to 5 per post, filterable). Separate
    # from `topics` above: `topics` is free-text and only feeds the profile
    # Curiosity Map, while `tags` is a normalized taxonomy used for
    # discovery and filtering on community pages.
    tags = relationship("Tag", secondary=post_tags, back_populates="posts")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=gen_uuid)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    parent_comment_id = Column(String, ForeignKey("comments.id"), nullable=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)

    # neutral | agree | challenge
    reply_type = Column(String(16), default="neutral")
    # Required when reply_type == "challenge" -- the Steel-Man Gate text.
    steelman_text = Column(Text, nullable=True)
    steelman_passed = Column(Boolean, nullable=True)
    # Three-outcome Steel-Man Gate verdict (v2): passed |
    # needs_improvement | failed. A challenge comment is publicly visible
    # only while its status is "passed" (author can always see their own
    # pending/failed attempts and revise them).
    steelman_status = Column(String(16), nullable=True)
    steelman_feedback = Column(Text, nullable=True)

    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now)

    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("user_id", "target_type", "target_id", name="uq_vote"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_type = Column(String(16), nullable=False)  # post | comment
    target_id = Column(String, nullable=False)
    value = Column(SmallInteger, nullable=False)  # -1 or 1
    created_at = Column(DateTime, default=now)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=gen_uuid)
    reporter_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_type = Column(String(16), nullable=False)
    target_id = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(16), default="pending")  # pending | reviewed | dismissed
    created_at = Column(DateTime, default=now)


class MediaAsset(Base):
    """An uploaded file, independent of any post. Images are inserted into a
    post's markdown body as ![](url) at upload time, so a post can reference
    zero, one, or many assets without a join table.

    `kind` is "image" for everything today. Adding video later means adding
    accepted mimetypes and a transcode step in the upload endpoint -- this
    table and the URL-embed pattern don't need to change.
    """

    __tablename__ = "media_assets"

    id = Column(String, primary_key=True, default=gen_uuid)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    kind = Column(String(20), nullable=False, default="image")
    url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    byte_size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=now)
