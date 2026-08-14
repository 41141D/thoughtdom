from tests.conftest import general_community_id
"""Regression tests for the search endpoints and community ownership
visibility, covering the stabilization round:

- Post search surfaces general posts to everyone (including logged-out
  visitors) but never surfaces a room post to a non-member.
- Community search is public (names are already listed on /communities).
- The communities list carries the signed-in viewer's role + member counts
  powering the "Your communities" split, while logged-out visitors get none.
- get_community carries the same membership visibility.
- Empty/whitespace search queries are rejected with 422.
"""


def _token(r):
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _anon_get(client, path, **kwargs):
    """Anonymous view: strip the client's cookie jar first so a previously
    set td_token can't authenticate the request (the jar is session-scoped)."""
    client.cookies.clear()
    return client.get(path, **kwargs)


def _create_community(client, token, name):
    r = client.post("/communities/", json={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _register(client, username, password="password123"):
    r = client.post(
        "/auth/register",
        json={"preferred_username": username, "password": password},
    )
    assert r.status_code == 200, r.text
    return _token(r)


def _join_and_approve(client, owner_token, community_name, member_username, member_token):
    r = client.post(
        f"/communities/{community_name}/join", headers=_auth(member_token)
    )
    assert r.status_code == 200, r.text
    requests = client.get(
        f"/communities/{community_name}/requests", headers=_auth(owner_token)
    )
    rid = next(x["id"] for x in requests.json() if x["username"] == member_username)
    r = client.post(
        f"/communities/{community_name}/requests/{rid}/approve", headers=_auth(owner_token)
    )
    assert r.status_code == 200, r.text
    return r


def _make_post(client, token, community_id, title, body):
    r = client.post(
        "/posts/",
        headers=_auth(token),
        json={"community_id": community_id, "title": title, "body": body, "tags": []},
    )
    assert r.status_code == 200, r.text
    return r.json()


# -------------------------------------------------------------------- tests


def test_search_posts_public_for_general(client):
    """General posts are discoverable even for logged-out visitors."""
    tok = _register(client, "generalposter2")
    post = _make_post(
        client, tok, general_community_id(client), "Quillsworth general post", "quillsearch body text"
    )
    anon_tok = _register(client, "generalviewer2")

    r = client.get("/search/posts", params={"q": "quillsworth"}, headers=_auth(anon_tok))
    assert r.status_code == 200
    assert any(x["id"] == post["id"] for x in r.json())

    # Logged-out visitor finds it too -- public discovery.
    anon = _anon_get(client, "/search/posts", params={"q": "quillsworth"})
    assert anon.status_code == 200
    assert any(x["id"] == post["id"] for x in anon.json())


def test_search_posts_hidden_from_non_member(client):
    """A room post must never appear in search results for a non-member."""
    o_tok = _register(client, "hiddenowner2")
    room = _create_community(client, o_tok, "hiddenroom2")
    post = _make_post(
        client, o_tok, room["id"], "Hidden quillsmith room post", "hiddenroom body"
    )

    out_tok = _register(client, "roomoutsider2")

    r = client.get("/search/posts", params={"q": "quillsmith"}, headers=_auth(out_tok))
    assert r.status_code == 200
    assert not r.json(), "non-member must not find room posts via search"

    # Owner finds their own room post.
    r = client.get("/search/posts", params={"q": "quillsmith"}, headers=_auth(o_tok))
    assert r.status_code == 200
    assert r.json()


def test_search_posts_after_join(client):
    """Joining a room makes its posts searchable for the new member."""
    o_tok = _register(client, "joinowner2")
    room = _create_community(client, o_tok, "joinroom2")
    _make_post(client, o_tok, room["id"], "Joinsearchable uniquepost", "joinroom body")

    m_tok = _register(client, "joinmember2")
    _join_and_approve(client, o_tok, "joinroom2", "joinmember2", m_tok)

    r = client.get("/search/posts", params={"q": "joinsearchable"}, headers=_auth(m_tok))
    assert r.status_code == 200
    assert r.json(), "member must find room posts after joining"


def test_search_posts_stops_after_leave(client):
    """Leaving a room removes its posts from the member's search results."""
    o_tok = _register(client, "leaveowner2")
    room = _create_community(client, o_tok, "leaveroom2")
    _make_post(client, o_tok, room["id"], "Leavehidden specialpost", "leaveroom body")

    m_tok = _register(client, "leavemember2")
    _join_and_approve(client, o_tok, "leaveroom2", "leavemember2", m_tok)

    r = client.get("/search/posts", params={"q": "leavehidden"}, headers=_auth(m_tok))
    assert r.json()

    client.post("/communities/leaveroom2/leave", headers=_auth(m_tok))

    r = client.get("/search/posts", params={"q": "leavehidden"}, headers=_auth(m_tok))
    assert r.status_code == 200
    assert not r.json(), "former member must no longer find room posts after leaving"


def test_search_communities_public(client):
    """Community names are public discovery, findable by anyone."""
    o_tok = _register(client, "commown2")
    _create_community(client, o_tok, "quarkclub2")

    r = client.get("/search/communities", params={"q": "quark"}, headers=_auth(o_tok))
    assert r.status_code == 200
    assert any(c["name"] == "quarkclub2" for c in r.json())

    # Logged-out also works.
    anon = _anon_get(client, "/search/communities", params={"q": "quark"})
    assert anon.status_code == 200
    assert any(c["name"] == "quarkclub2" for c in anon.json())


def test_search_rejects_empty_query(client):
    """Whitespace-only or empty queries are rejected, not silently widened."""
    for q in ("", "   "):
        r = client.get("/search/posts", params={"q": q})
        assert r.status_code == 422, q
        r = client.get("/search/communities", params={"q": q})
        assert r.status_code == 422, q


def test_communities_list_shows_membership_for_signed_in(client):
    """The signed-in viewer sees their own role + member counts; anon doesn't."""
    o_tok = _register(client, "listowner2")
    room = _create_community(client, o_tok, "visroom2")

    m_tok = _register(client, "listmember2")
    _join_and_approve(client, o_tok, "visroom2", "listmember2", m_tok)

    # Owner sees ownership on their room.
    listing = client.get("/communities/", headers=_auth(o_tok)).json()
    mine = next(c for c in listing if c["name"] == "visroom2")
    assert mine["role"] == "owner", f"expected role owner, got {mine}"
    assert mine["member_count"] >= 2, mine  # owner + approved member
    assert mine["is_member"] is True

    # Member sees membership without ownership.
    listing = client.get("/communities/", headers=_auth(m_tok)).json()
    mine = next(c for c in listing if c["name"] == "visroom2")
    assert mine["role"] == "member", mine
    assert mine["is_member"] is True

    # General stays open to everyone: no membership row for anyone.
    general = next(c for c in listing if c["is_default"])
    assert general["role"] is None, general

    # Logged-out visitor gets no ownership data at all.
    anon = _anon_get(client, "/communities/").json()
    aroom = next(c for c in anon if c["name"] == "visroom2")
    assert aroom["role"] is None
    # Logged-out visitors get no affirmative membership -- False or None are
    # both acceptable (an explicit False is more honest than null).
    assert not aroom["is_member"]


def test_get_community_shows_membership_and_counts(client):
    """The community detail output carries the viewer's role + member count."""
    o_tok = _register(client, "detailowner2")
    room = _create_community(client, o_tok, "detailroom2")

    detail = client.get(f"/communities/detailroom2", headers=_auth(o_tok)).json()
    assert detail["role"] == "owner", detail
    assert detail["member_count"] >= 1

    # Anon gets the member count but no role.
    anon = _anon_get(client, "/communities/detailroom2").json()
    assert anon["member_count"] >= 1
    assert anon["role"] is None
