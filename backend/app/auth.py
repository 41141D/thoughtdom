from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Using the bcrypt library directly rather than passlib -- passlib's bcrypt
# backend probes bcrypt.__about__.__version__ to detect the installed
# version, which recent bcrypt releases removed. That mismatch throws an
# AttributeError on the first hash/verify call, which is the most likely
# cause if registration is throwing "Failed to fetch" in the browser (the
# connection drops before a clean HTTP response goes out).
_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(_BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


COOKIE_NAME = "td_token"


def _user_from_token(token: str, db: Session) -> User:
    user_id = decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account banned")
    return user


def _token_from_request(request: Request) -> Optional[str]:
    """An explicit `Authorization: Bearer <token>` header wins (legacy/
    non-browser API clients and the test suite); otherwise the browser
    session's HttpOnly `td_token` cookie is used. The browser frontend
    never sends an Authorization header, so the cookie stays its only
    session credential."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]
    return request.cookies.get(COOKIE_NAME)


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    """Require an authenticated browser session (HttpOnly cookie) or a Bearer
    token for legacy/non-browser API clients."""
    token = _token_from_request(request)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _user_from_token(token, db)


def get_current_user_optional(
    request: Request, db: Session = Depends(get_db)
) -> Optional[User]:
    """Like get_current_user, but returns None instead of raising when there's
    no token or it's invalid. Used on read endpoints (feed, comment list) so
    they can include the viewer's own vote state without requiring sign-in."""
    token = _token_from_request(request)
    if token is None:
        return None
    try:
        user_id = decode_token(token)
    except HTTPException:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.is_banned:
        return None
    return user
