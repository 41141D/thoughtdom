"""Shared fixtures for the ThoughtDom backend test suite.

Runs entirely in-process against a fresh SQLite database, so CI/local runs
need no Postgres/Redis. Redis absence degrades rate limiting to a no-op,
which is exactly the behavior being tested in rate_limit degradation.
"""

import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

# Force dev-safe settings BEFORE the app imports config (config.py sets
# module-level constants at import time, so env vars must be set first).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATABASE_URL"] = f"sqlite:///./test-{uuid.uuid4().hex}.db"
# Must start with "dev-": the backend sets the cookie Secure flag only in
# non-dev environments (jwt_secret.startswith("dev-") => dev). Tests run over
# plain http via TestClient, which correctly drops Secure cookies.
os.environ["JWT_SECRET"] = f"dev-test-secret-{uuid.uuid4().hex}"
# Deliberately leave Supabase credentials unset: media tests verify the
# local fallback path specifically.
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
os.environ["ENVIRONMENT"] = "test"
# The suite exercises rate limiting with real Redis whenever it is available
# (that mirrors production), so the signup/login ceilings are raised here:
# ~60 test users register in one run, and several tests log in repeatedly.
# These overrides only apply while tests import config, before settings are
# frozen; they never touch production defaults.
# Each run gets its own isolated Redis database number so leftover counters
# from previous runs can't 429 this run's signup burst (production realism
# without cross-run pollution).
os.environ["REDIS_URL"] = f"redis://localhost:6379/{uuid.uuid4().int % 14}"
os.environ["RATE_LIMIT_SIGNUPS_PER_HOUR_PER_IP"] = "200"
os.environ["RATE_LIMIT_LOGINS_PER_MIN_PER_IP"] = "200"
os.environ["RATE_LIMIT_VOTES_PER_MIN"] = "1000"
os.environ["RATE_LIMIT_COMMENTS_PER_MIN"] = "200"
os.environ["RATE_LIMIT_POSTS_PER_MIN"] = "100"


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clear_test_cookies(client):
    """The session-scoped client keeps a cookie jar across tests. Auth now
    accepts the HttpOnly `td_token` cookie (cookie first, Bearer fallback),
    so stale cookies from earlier tests would override later tests' Bearer
    headers and authenticate as the wrong user. Clear them before every
    test -- this preserves production semantics while keeping the suite
    deterministic."""
    client.cookies.clear()


@pytest.fixture()
def db_session():
    from app.database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    db_path = os.environ["DATABASE_URL"].split("///", 1)[1]
    if os.path.exists(db_path):
        os.remove(db_path)


def create_user(client, password="password123", preferred_username=None):
    """Register a test user. Since the no-silent-rename fix, the API rejects
    registrations that specify neither a username nor the explicit opt-in
    for a random anonymous identity -- so tests that don't care about the
    exact name opt in (random_username=True) while tests that pin a name
    pass preferred_username as before."""
    body = {"password": password}
    if preferred_username:
        body["preferred_username"] = preferred_username
    else:
        body["random_username"] = True
    return client.post("/auth/register", json=body)


def general_community_id(client):
    """The seed block creates 'general'; create-post looks up by UUID id, so
    resolve it through the public communities list rather than hard-coding."""
    r = client.get("/communities/")
    assert r.status_code == 200 and r.json(), "the 'general' seed must exist"
    return r.json()[0]["id"]
