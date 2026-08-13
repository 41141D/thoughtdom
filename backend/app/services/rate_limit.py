"""
Token-bucket-ish rate limiting backed by Redis.

Design note (see the architecture doc, Section 6): rate limiting is the
single highest-leverage anti-abuse tool on an anonymous platform, since we
deliberately don't have identity signals to fall back on. It's applied
per-user (by user id) rather than per-IP where possible, since IP is a much
weaker anonymity boundary to build product logic on top of.

If Redis is unreachable (e.g. local dev without a redis container running),
this fails OPEN -- i.e. it does not block requests -- so the app is still
usable for local development. That fallback is intentionally logged loudly;
it must never be silently relied on in production.
"""

import logging
import time

import redis

from app.config import settings

logger = logging.getLogger("thoughtdom.rate_limit")

try:
    _redis_client = redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.5)
    _redis_client.ping()
    REDIS_AVAILABLE = True
except Exception:
    _redis_client = None
    REDIS_AVAILABLE = False
    logger.warning(
        "Redis unavailable at %s -- rate limiting is DISABLED. "
        "This is fine for local dev, NEVER acceptable in production.",
        settings.redis_url,
    )


def check_rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    """
    Returns True if the action is allowed, False if the caller has exceeded
    `limit` actions within `window_seconds`. Uses a simple fixed-window
    counter -- good enough for MVP; swap for a sliding-window/leaky-bucket
    Lua script if you need tighter burst control later.
    """
    if not REDIS_AVAILABLE:
        return True

    bucket = f"ratelimit:{key}:{int(time.time()) // window_seconds}"
    try:
        current = _redis_client.incr(bucket)
        if current == 1:
            _redis_client.expire(bucket, window_seconds)
        return current <= limit
    except Exception:
        logger.exception("Redis error during rate limit check -- failing open")
        return True


def enforce_rate_limit(key: str, limit: int, window_seconds: int, action: str) -> None:
    from fastapi import HTTPException, status

    if not check_rate_limit(key, limit, window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {action}. Try again shortly.",
        )
