from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.database import get_db
from app.config import settings
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.services.rate_limit import check_rate_limit
from app.services.username_gen import generate_username

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", tags=["auth"])
def me(request: Request, db: Session = Depends(get_db)):
    """Bootstraps/re-validates the current session. Reads the td_token cookie
    first (browser flow), falling back to the Authorization header (legacy
    localStorage flow). Returns 401 when no valid session exists -- the
    frontend uses this to distinguish 'not signed in' from 'fetch failed'."""
    from app.auth import decode_token

    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    user_id = decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"username": user.username, "id": user.id}


@router.post("/logout", tags=["auth"])
def logout():
    """Clears the session cookie. Also clears td_username from localStorage
    on the frontend side -- the cookie can't be removed by page scripts,
    which is exactly why it's HttpOnly in the first place."""
    resp = JSONResponse({"status": "signed_out"})
    resp.delete_cookie(key=COOKIE_NAME, path="/")
    return resp


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(
        f"signup:{client_ip}", settings.rate_limit_signups_per_hour_per_ip, 3600
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many accounts created from this network recently.",
        )

    username = payload.preferred_username
    if username:
        exists = db.query(User).filter(User.username == username).first()
        if exists:
            username = None  # fall back to random generation below

    if not username:
        for _ in range(10):
            candidate = generate_username()
            if not db.query(User).filter(User.username == candidate).first():
                username = candidate
                break
        else:
            raise HTTPException(status_code=500, detail="Could not allocate a username, try again")

    user = User(username=username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    resp = JSONResponse(TokenResponse(access_token=token, username=user.username).model_dump())
    _set_session_cookie(resp, token)
    return resp


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    # Keyed by IP, not username: keying by username would let an attacker
    # learn which usernames exist by watching which keys get rate-limited.
    if not check_rate_limit(f"login:{client_ip}", settings.rate_limit_logins_per_min_per_ip, 60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts from this network. Try again shortly.",
        )

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account banned")

    token = create_access_token(user.id)
    resp = JSONResponse(TokenResponse(access_token=token, username=user.username).model_dump())
    _set_session_cookie(resp, token)
    return resp


# One shared session cookie for the browser flow (cookie, not just a bearer
# token in localStorage). HttpOnly keeps it unreadable to page scripts, so an
# XSS payload can't harvest it. Secure only in production since localhost dev
# runs over plain http. SameSite=Lax allows the GET /auth/me bootstrap while
# still blocking cross-site POST/DELETE requests that try to reuse it.
COOKIE_NAME = "td_token"
COOKIE_MAX_AGE = settings.access_token_expire_minutes * 60


def _set_session_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=not settings.jwt_secret.startswith("dev-"),
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
