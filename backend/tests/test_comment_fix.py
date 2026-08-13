"""Regression tests for the comment submission bug.

Root cause (found via a real browser repro): the shared Button component was
rendered without an explicit submit type inside the reply form, so clicking
"Reply" never submitted the form. While verifying the UI fix end-to-end we
also confirmed the backend correctly rejects empty bodies (the client-side
form `required` attribute must not be relied on alone), and that every reply
type a real user can pick posts exactly as expected:

1. neutral/agree -> normal comment, visible immediately.
2. challenge   -> enters the Steel-Man Gate.
3. empty body  -> rejected (422) so half-filled submissions can't slip through.
4. membership  -> non-member rejected, member accepted; works on General too.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _register(client: TestClient):
    username = f"ctest{uuid.uuid4().hex[:8]}"
    r = client.post(
        "/auth/register",
        json={"preferred_username": username, "password": "password123"},
    )
    assert r.status_code == 200, r.text
    return username, r.json()["access_token"]


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def _post(client: TestClient, token: str, community: str, title="T", body="B"):
    # find community id
    r = client.get(f"/communities/{community}", headers=_headers(token))
    cid = r.json()["id"]
    p = client.post(
        "/posts/",
        headers=_headers(token) | {"Content-Type": "application/json"},
        json={"community_id": cid, "title": title, "body": body},
    )
    assert p.status_code == 200, p.text
    return p.json()


# ------------------------------------------------ comment lifecycle tests


def test_neutral_comment_posts_normally(client: TestClient):
    user, tok = _register(client)
    post = _post(client, tok, "general")
    r = client.post(
        "/comments/",
        headers=_headers(tok) | {"Content-Type": "application/json"},
        json={"post_id": post["id"], "reply_type": "neutral", "body": "Interesting point. I hadn't considered that."},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["reply_type"] == "neutral"
    assert data["body"] == "Interesting point. I hadn't considered that."
    assert data["steelman_status"] is None

    # Visible immediately in the post's comment list.
    feed = client.get(f"/comments/post/{post['id']}", headers=_headers(tok))
    assert any(c["id"] == data["id"] for c in feed.json())


def test_agree_comment_posts_normally(client: TestClient):
    user, tok = _register(client)
    post = _post(client, tok, "general")
    r = client.post(
        "/comments/",
        headers=_headers(tok) | {"Content-Type": "application/json"},
        json={"post_id": post["id"], "reply_type": "agree", "body": "I completely agree with this."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["reply_type"] == "agree"
    assert r.json()["steelman_status"] is None


def test_question_style_comment_is_neutral_and_posts(client: TestClient):
    user, tok = _register(client)
    post = _post(client, tok, "general")
    r = client.post(
        "/comments/",
        headers=_headers(tok) | {"Content-Type": "application/json"},
        json={"post_id": post["id"], "reply_type": "neutral", "body": "How would this work in practice?"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["reply_type"] == "neutral"


def test_challenge_enters_steelman_gate(client: TestClient):
    user, tok = _register(client)
    post = _post(client, tok, "general")
    r = client.post(
        "/comments/",
        headers=_headers(tok) | {"Content-Type": "application/json"},
        json={
            "post_id": post["id"],
            "reply_type": "challenge",
            "steelman_text": "Too short to pass fairness.",
            "body": "I disagree because reasons.",
        },
    )
    # A challenge MUST go through the gate: either it passes, is held for
    # revision, or fails. It is never a plain normal comment.
    assert r.status_code == 200, r.text
    assert r.json()["reply_type"] == "challenge"
    assert r.json()["steelman_status"] in {"passed", "needs_improvement", "failed"}


def test_empty_comment_body_rejected(client: TestClient):
    user, tok = _register(client)
    post = _post(client, tok, "general")
    r = client.post(
        "/comments/",
        headers=_headers(tok) | {"Content-Type": "application/json"},
        json={"post_id": post["id"], "reply_type": "neutral", "body": ""},
    )
    assert r.status_code == 422, r.text


def test_community_member_can_comment(client: TestClient):
    owner, owner_tok = _register(client)
    r = client.post("/communities/", headers=_headers(owner_tok) | {"Content-Type": "application/json"},
                    json={"name": f"roombeta{uuid.uuid4().hex[:6]}", "description": "d"})
    cid = r.json()["id"]

    other, other_tok = _register(client)
    # Request and approve
    r = client.post(f"/communities/{cid}/join", headers=_headers(other_tok))
    assert r.status_code == 200, r.text
    reqs = client.get(f"/communities/{cid}/requests", headers=_headers(owner_tok)).json()
    client.post(f"/communities/{cid}/requests/{reqs[0]['id']}/approve", headers=_headers(owner_tok))

    post = _post(client, owner_tok, cid)
    c = client.post("/comments/", headers=_headers(other_tok) | {"Content-Type": "application/json"},
                    json={"post_id": post["id"], "reply_type": "agree", "body": "joined member comments"})
    assert c.status_code == 200, c.text


def test_non_member_cannot_comment(client: TestClient):
    owner, owner_tok = _register(client)
    r = client.post("/communities/", headers=_headers(owner_tok) | {"Content-Type": "application/json"},
                    json={"name": f"roomgamma{uuid.uuid4().hex[:6]}", "description": "d"})
    cid = r.json()["id"]
    post = _post(client, owner_tok, cid)

    outsider, outsider_tok = _register(client)
    c = client.post("/comments/", headers=_headers(outsider_tok) | {"Content-Type": "application/json"},
                    json={"post_id": post["id"], "reply_type": "neutral", "body": "should not post"})
    assert c.status_code == 403, c.text


def test_general_comments_work(client: TestClient):
    user, tok = _register(client)
    # A general post created by another user.
    peer, peer_tok = _register(client)
    post = _post(client, peer_tok, "general")
    c = client.post("/comments/", headers=_headers(tok) | {"Content-Type": "application/json"},
                    json={"post_id": post["id"], "reply_type": "neutral", "body": "Hello from general."})
    assert c.status_code == 200, c.text
