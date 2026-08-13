from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---- Auth ----

class RegisterRequest(BaseModel):
    password: str = Field(min_length=8)
    preferred_username: Optional[str] = None
    random_username: bool = False  # opt-in anonymous identity; never silent


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


# ---- Community ----

import re

COMMUNITY_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


class CommunityCreate(BaseModel):
    name: str
    description: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if len(trimmed) < 3 or len(trimmed) > 30:
            raise ValueError("Community name must be between 3 and 30 characters")
        if not COMMUNITY_NAME_PATTERN.match(trimmed):
            raise ValueError(
                "Community name can only contain letters, numbers, underscores and hyphens"
            )
        return trimmed

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        return value.strip()[:500] if value else ""


class CommunityOut(BaseModel):
    id: str
    name: str
    description: str
    creator_username: Optional[str] = None
    post_count: int = 0
    member_count: int = 0
    is_default: bool = False
    created_at: datetime
    # Membership visibility for the current viewer (populated by the search
    # and membership endpoints). Existing clients that don't need it simply
    # ignore the extra fields.
    is_member: Optional[bool] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True


# ---- Community leadership & membership ----

MEMBERSHIP_ROLES = ("owner", "moderator", "member")


class MembershipOut(BaseModel):
    """A user's role inside a community. The `general` default community
    carries no membership rows -- it is public to everyone."""
    id: str
    community_id: str
    username: str
    role: str  # owner | moderator | member
    created_at: datetime

    class Config:
        from_attributes = True


class MembershipAction(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(moderator|member)$")


class CommunitySettingsUpdate(BaseModel):
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: Optional[str]) -> Optional[str]:
        return value.strip()[:500] if value else ""


# ---- Posts ----

MAX_TAGS_PER_POST = 5
MAX_TAG_LENGTH = 30


class PostCreate(BaseModel):
    community_id: str
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)
    topics: Optional[str] = Field(default=None, max_length=300)
    # Raw tags as typed by the user (any case/whitespace) -- normalization
    # (lowercase + trim) and dedup happen here so every caller of this
    # schema (API, tests) gets the same guarantees for free.
    tags: Optional[list[str]] = Field(default=None)
    forked_from_post_id: Optional[str] = None

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if not value:
            return None

        normalized: list[str] = []
        for raw in value:
            tag = raw.strip().lower()
            if not tag:
                continue  # empty tags are silently dropped, not rejected
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"Tag '{raw}' exceeds {MAX_TAG_LENGTH} characters")
            if tag not in normalized:  # de-dupe, case-insensitive via prior lowercasing
                normalized.append(tag)

        if len(normalized) > MAX_TAGS_PER_POST:
            raise ValueError(f"A post can have at most {MAX_TAGS_PER_POST} tags")

        return normalized or None


class PostOut(BaseModel):
    id: str
    author_username: str
    community_id: str
    community_name: str
    title: str
    body: str
    topics: Optional[str] = None
    tags: list[str] = []
    score: int
    my_vote: Optional[int] = None
    is_pinned: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TagCount(BaseModel):
    name: str
    post_count: int


# ---- Comments ----

class CommentCreate(BaseModel):
    post_id: str
    parent_comment_id: Optional[str] = None
    reply_type: str = Field(default="neutral", pattern="^(neutral|agree|challenge)$")
    steelman_text: Optional[str] = None
    body: str = Field(min_length=1)


class CommentOut(BaseModel):
    id: str
    post_id: str
    parent_comment_id: Optional[str]
    author_username: str
    reply_type: str
    steelman_text: Optional[str]
    steelman_passed: Optional[bool]
    # Three-outcome Steel-Man Gate v2 verdict: "passed" | "needs_improvement"
    # | "failed". Legacy rows that passed the old binary gate surface as
    # "passed"; neutral/agree comments are null (the gate only applies to
    # challenges).
    steelman_status: Optional[str] = None
    # Private guidance for pending/failed attempts -- only meaningful to
    # the comment's author; empty for passed challenges.
    steelman_feedback: Optional[str] = None
    body: str
    score: int
    my_vote: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SteelmanRevise(BaseModel):
    """Re-attempt a steelman_text for a comment held at needs_improvement.
    Re-evaluation follows the same three-outcome rules; feedback returns on
    another needs_improvement so the author can iterate."""
    steelman_text: str = Field(min_length=6)


# ---- Votes ----

class VoteRequest(BaseModel):
    target_type: str = Field(pattern="^(post|comment)$")
    target_id: str
    value: int = Field(ge=-1, le=1)


# ---- Reports ----

class ReportCreate(BaseModel):
    target_type: str = Field(pattern="^(post|comment)$")
    target_id: str
    reason: str = Field(min_length=1, max_length=2000)


# ---- Media ----

class MediaAssetOut(BaseModel):
    id: str
    kind: str
    url: str
    thumbnail_url: Optional[str]
    width: Optional[int]
    height: Optional[int]
    byte_size: int

    class Config:
        from_attributes = True


# ---- Profiles ----

class TopicStat(BaseModel):
    topic: str
    count: int
    weight: float  # 0..1, relative to this user's most-discussed topic


class ActivityItem(BaseModel):
    type: str  # "post" | "comment"
    id: str
    post_id: str
    title: Optional[str] = None  # posts only
    excerpt: str
    score: int
    created_at: datetime


class Milestone(BaseModel):
    label: str
    date: Optional[datetime] = None  # None for undated reputation milestones


class UserProfileOut(BaseModel):
    username: str
    joined_at: datetime
    reputation: int
    helpful_posts: int
    helpful_comments: int
    communities: list[str]
    topics: list[TopicStat]
    recent_activity: list[ActivityItem]
    timeline: list[Milestone]
    reputation_milestones: list[Milestone]
