"""Regression tests for the community isolation model.

Mental model being enforced (spec):

    GENERAL   -> public global discussion -> homepage -> everyone participates
    COMMUNITY -> separate room -> publicly viewable -> join to participate

Covers: global feed scoping, global tag scoping, posting/commenting
membership enforcement, the join/leave/remove/ban edge cases, and isolation
between two user-created communities.

Run with the rest of the suite: `python3 -m pytest` from the backend root.
"""

from tests.conftest import create_user, general_community_id

# ------------------------------------------------------------------ helpers


def _token(r):
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create_community(client, token, name):
    r = client.post("/communities/", json={"name": name}, headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _join_and_approve(client, owner_token, community_name, member_username, member_token):
    """Full request-approve flow used by several tests."""
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


def _make_moderator(client, owner_token, community_name, member_username):
    r = client.put(
        f"/communities/{community_name}/members/{member_username}",
        json={"role": "moderator"},
        headers=_auth(owner_token),
    )
    assert r.status_code == 200, r.text
    return r


def _make_post(client, token, community_id, title="t", body="b", tags=None):
    payload = {"community_id": community_id, "title": title, "body": body}
    if tags:
        payload["tags"] = tags
    r = client.post("/posts/", json=payload, headers=_auth(token))
    return r


def _make_comment(client, token, post_id, body="c", reply_type="neutral", steelman_text=None):
    payload = {"post_id": post_id, "body": body, "reply_type": reply_type}
    if steelman_text is not None:
        payload["steelman_text"] = steelman_text
    return client.post("/comments/", json=payload, headers=_auth(token))


def _set_banned(client, username, banned):
    """Flip User.is_banned directly at the ORM level -- there is no public
    admin ban endpoint, and the auth layer (what these tests guard) treats
    is_banned the same regardless of who set it."""
    from app.database import SessionLocal
    from app.models import User

    with SessionLocal() as s:
        u = s.query(User).filter(User.username == username).one()
        u.is_banned = banned
        s.commit()
        return u.id


# -------------------------------------------------------------- global feed


def test_general_post_appears_in_global_feed(client):
    r = create_user(client, preferred_username="genposter")
    r = _make_post(client, _token(r), general_community_id(client))
    assert r.status_code == 200, r.text
    post_id = r.json()["id"]
    ids = [p["id"] for p in client.get("/posts/").json()]
    assert post_id in ids, "General posts must appear on the homepage"


def test_community_post_absent_from_global_feed(client):
    owner = create_user(client, preferred_username="roomowner")
    room = _create_community(client, _token(owner), "roomone")

    insider = create_user(client, preferred_username="roomoneuser")
    r = client.post(
        f"/communities/roomone/join", headers=_auth(_token(insider))
    )
    assert r.status_code == 200
    requests = client.get("/communities/roomone/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "roomoneuser")
    client.post(f"/communities/roomone/requests/{rid}/approve", headers=_auth(_token(owner)))

    p = _make_post(client, _token(insider), room["id"])
    assert p.status_code == 200, p.text
    ids = [x["id"] for x in client.get("/posts/").json()]
    assert p.json()["id"] not in ids, "Community posts must never leak onto the homepage"


def test_global_tag_filter_cannot_expose_community_posts(client):
    """A global tag filter is a General-only feature: room posts tagged
    `python` must not surface through /posts/?tag=python."""
    owner = create_user(client, preferred_username="roomowner2")
    room = _create_community(client, _token(owner), "roomtwo")

    insider = create_user(client, preferred_username="roomtwouser")
    r = client.post(f"/communities/roomtwo/join", headers=_auth(_token(insider)))
    assert r.status_code == 200
    requests = client.get("/communities/roomtwo/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "roomtwouser")
    client.post(f"/communities/roomtwo/requests/{rid}/approve", headers=_auth(_token(owner)))

    p = _make_post(client, _token(insider), room["id"], title="t", body="b", tags=["python"])
    assert p.status_code == 200, p.text

    leaked = client.get("/posts/?tag=python").json()
    assert not any(x["id"] == p.json()["id"] for x in leaked), (
        "Global tag filter must not pull community posts in"
    )

    # But the same tag is legitimately visible within the room.
    room_tagged = client.get("/communities/roomtwo/posts?tag=python").json()
    assert any(x["id"] == p.json()["id"] for x in room_tagged)


def test_global_tags_list_omits_community_only_tags(client):
    """The homepage tag row must not advertise tags used only in rooms."""
    owner = create_user(client, preferred_username="roomowner3")
    room = _create_community(client, _token(owner), "roomthree")
    insider = create_user(client, preferred_username="roomthreeuser")
    r = client.post(f"/communities/roomthree/join", headers=_auth(_token(insider)))
    assert r.status_code == 200
    requests = client.get("/communities/roomthree/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "roomthreeuser")
    client.post(f"/communities/roomthree/requests/{rid}/approve", headers=_auth(_token(owner)))
    _make_post(client, _token(insider), room["id"], title="t", body="b", tags=["rustonly"])

    names = [x["name"] for x in client.get("/tags/").json()]
    assert "rustonly" not in names, "Global tags must not leak room-only tags"


# -------------------------------------------------------------- posting ----


def test_member_can_create_community_post(client):
    owner = create_user(client, preferred_username="mowner")
    room = _create_community(client, _token(owner), "memtest")
    m = create_user(client, preferred_username="mmember")
    r = client.post(f"/communities/memtest/join", headers=_auth(_token(m)))
    assert r.status_code == 200
    requests = client.get("/communities/memtest/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "mmember")
    client.post(f"/communities/memtest/requests/{rid}/approve", headers=_auth(_token(owner)))

    p = _make_post(client, _token(m), room["id"])
    assert p.status_code == 200, p.text


def test_non_member_post_is_403(client):
    owner = create_user(client, preferred_username="nowner")
    room = _create_community(client, _token(owner), "notmem")
    outsider = create_user(client, preferred_username="outsider5")
    p = _make_post(client, _token(outsider), room["id"])
    assert p.status_code == 403, p.text
    assert "join" in p.json()["detail"].lower(), "Error must say to join first"


def test_owner_can_create_post(client):
    owner = create_user(client, preferred_username="oowner")
    room = _create_community(client, _token(owner), "ownertest")
    p = _make_post(client, _token(owner), room["id"])
    assert p.status_code == 200, p.text


def test_moderator_can_create_post(client):
    owner = create_user(client, preferred_username="modowner")
    _create_community(client, _token(owner), "modtest")
    mod = create_user(client, preferred_username="moduser")
    r = client.post(f"/communities/modtest/join", headers=_auth(_token(mod)))
    assert r.status_code == 200
    requests = client.get("/communities/modtest/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "moduser")
    client.post(f"/communities/modtest/requests/{rid}/approve", headers=_auth(_token(owner)))
    _make_moderator(client, _token(owner), "modtest", "moduser")

    room = client.get("/communities/modtest").json()
    p = _make_post(client, _token(mod), room["id"])
    assert p.status_code == 200, p.text


def test_leaving_community_blocks_posting(client):
    owner = create_user(client, preferred_username="lowner")
    room = _create_community(client, _token(owner), "leavetest")
    m = create_user(client, preferred_username="leaver")
    r = client.post(f"/communities/leavetest/join", headers=_auth(_token(m)))
    assert r.status_code == 200
    requests = client.get("/communities/leavetest/requests", headers=_auth(_token(owner))).json()
    rid = next(x["id"] for x in requests if x["username"] == "leaver")
    client.post(f"/communities/leavetest/requests/{rid}/approve", headers=_auth(_token(owner)))
    # Sanity: can post while a member.
    assert _make_post(client, _token(m), room["id"]).status_code == 200

    client.post(f"/communities/leavetest/leave", headers=_auth(_token(m)))
    p = _make_post(client, _token(m), room["id"])
    assert p.status_code == 403, "Left the room -- posting must be gone"


def test_removed_user_cannot_post(client):
    owner = create_user(client, preferred_username="rmowner")
    room = _create_community(client, _token(owner), "removetest")
    m = create_user(client, preferred_username="removee")
    _join_and_approve(client, _token(owner), "removetest", "removee", _token(m))

    client.delete(
        f"/communities/removetest/members/removee", headers=_auth(_token(owner))
    )
    p = _make_post(client, _token(m), room["id"])
    assert p.status_code == 403, "Removed members are no longer members"


def test_banned_user_cannot_post(client):
    owner = create_user(client, preferred_username="bowner")
    room = _create_community(client, _token(owner), "bantest")
    m = create_user(client, preferred_username="bandee")
    _join_and_approve(client, _token(owner), "bantest", "bandee", _token(m))

    user_id = _set_banned(client, "bandee", True)  # noqa: F841
    p = _make_post(client, _token(m), room["id"])
    assert p.status_code in (401, 403), "Banned accounts must not post anywhere"

    # And a General post must fail too (site-wide ban).
    g = _make_post(client, _token(m), general_community_id(client))
    assert g.status_code in (401, 403)

    _set_banned(client, "bandee", False)


def test_general_posting_needs_no_membership(client):
    """General is open to every authenticated user -- no membership rows,
    no join dance."""
    r = create_user(client, preferred_username="genuser")
    p = _make_post(client, _token(r), general_community_id(client))
    assert p.status_code == 200, p.text
    membership = client.get(
        "/communities/general/membership", headers=_auth(_token(r))
    ).json()
    assert membership["is_general"] is True


# ------------------------------------------------------------------ comments


def test_member_can_comment_on_community_post(client):
    owner = create_user(client, preferred_username="cowner")
    room = _create_community(client, _token(owner), "comtest")
    m = create_user(client, preferred_username="ccommenter")
    _join_and_approve(client, _token(owner), "comtest", "ccommenter", _token(m))

    post = _make_post(client, _token(owner), room["id"])
    assert post.status_code == 200
    c = _make_comment(client, _token(m), post.json()["id"], body="great post!")
    assert c.status_code == 200, c.text
    assert c.json()["reply_type"] == "neutral"


def test_non_member_cannot_comment(client):
    owner = create_user(client, preferred_username="ncowner")
    room = _create_community(client, _token(owner), "nocom")
    outsider = create_user(client, preferred_username="outsider2")
    post = _make_post(client, _token(owner), room["id"])
    assert post.status_code == 200

    c = _make_comment(client, _token(outsider), post.json()["id"], body="agree!")
    assert c.status_code == 403, c.text


def test_non_member_cannot_reply(client):
    """A reply (parent_comment_id) to a room post's existing comment also
    counts as participating in the room."""
    owner = create_user(client, preferred_username="rowner")
    room = _create_community(client, _token(owner), "replytest")
    m = create_user(client, preferred_username="replymember")
    _join_and_approve(client, _token(owner), "replytest", "replymember", _token(m))

    post = _make_post(client, _token(owner), room["id"])
    assert post.status_code == 200
    parent = _make_comment(client, _token(m), post.json()["id"], body="parent")
    assert parent.status_code == 200

    outsider = create_user(client, preferred_username="outsider3")
    r = client.post(
        "/comments/",
        json={"post_id": post.json()["id"], "parent_comment_id": parent.json()["id"], "body": "reply"},
        headers=_auth(_token(outsider)),
    )
    assert r.status_code == 403, r.text


def test_non_member_cannot_create_challenge(client):
    """Challenges are participation too -- the Steel-Man Gate is reached
    only by members, never by passers-by."""
    owner = create_user(client, preferred_username="chowowner")
    room = _create_community(client, _token(owner), "challengetest")
    outsider = create_user(client, preferred_username="outsider4")
    post = _make_post(client, _token(owner), room["id"])
    assert post.status_code == 200

    r = client.post(
        "/comments/",
        json={
            "post_id": post.json()["id"],
            "reply_type": "challenge",
            "steelman_text": "You argue that x. I accept x but ...",
            "body": "disagree, actually",
        },
        headers=_auth(_token(outsider)),
    )
    assert r.status_code == 403, "Challenge = participating = membership"


def test_general_comments_still_work(client):
    """Agreement, neutral, and questions on General posts post straight
    through; only challenges go through the Gate."""
    r = create_user(client, preferred_username="gencommenter")
    token = _token(r)
    post = _make_post(client, token, general_community_id(client))
    assert post.status_code == 200
    post_id = post.json()["id"]

    for body, reply_type in (
        ("I completely agree, great point", "agree"),
        ("Adding a related example for context", "neutral"),
        ("When did this change?", "neutral"),
    ):
        c = _make_comment(client, token, post_id, body=body, reply_type=reply_type)
        assert c.status_code == 200, c.text
        assert c.json()["steelman_status"] is None, "Non-challenges skip the gate entirely"
    public = [x["id"] for x in client.get(f"/comments/post/{post_id}").json()]
    assert len(public) == 3, "All three ordinary comments must be publicly visible"

    # And a real disagreement still enters the existing Steel-Man Gate.
    ch = client.post(
        "/comments/",
        json={
            "post_id": post_id,
            "reply_type": "challenge",
            "steelman_text": "nope",
            "body": "disagree",
        },
        headers=_auth(token),
    )
    assert ch.status_code == 200
    assert ch.json()["steelman_status"] in ("passed", "needs_improvement", "failed")


# ---------------------------------------------------------------- isolation


def test_member_of_a_cannot_post_in_b(client):
    owner_a = create_user(client, preferred_username="aowner")
    owner_b = create_user(client, preferred_username="bowner4")
    room_a = _create_community(client, _token(owner_a), "roomalpha")
    room_b = _create_community(client, _token(owner_b), "roombeta")

    m = create_user(client, preferred_username="alphamember")
    r = client.post(f"/communities/roomalpha/join", headers=_auth(_token(m)))
    assert r.status_code == 200
    requests = client.get("/communities/roomalpha/requests", headers=_auth(_token(owner_a))).json()
    rid = next(x["id"] for x in requests if x["username"] == "alphamember")
    client.post(f"/communities/roomalpha/requests/{rid}/approve", headers=_auth(_token(owner_a)))

    assert _make_post(client, _token(m), room_a["id"]).status_code == 200
    p = _make_post(client, _token(m), room_b["id"])
    assert p.status_code == 403, "Membership does not transfer between rooms"


def test_room_a_posts_absent_from_room_b(client):
    owner_a = create_user(client, preferred_username="aowner2")
    owner_b = create_user(client, preferred_username="bowner2")
    room_a = _create_community(client, _token(owner_a), "roomgamma")
    room_b = _create_community(client, _token(owner_b), "roomdelta")
    m = create_user(client, preferred_username="betamember")
    r = client.post(f"/communities/roomdelta/join", headers=_auth(_token(m)))
    assert r.status_code == 200
    requests = client.get("/communities/roomdelta/requests", headers=_auth(_token(owner_b))).json()
    rid = next(x["id"] for x in requests if x["username"] == "betamember")
    client.post(f"/communities/roomdelta/requests/{rid}/approve", headers=_auth(_token(owner_b)))

    post_a = _make_post(client, _token(owner_a), room_a["id"])
    assert post_a.status_code == 200
    ids_b = [x["id"] for x in client.get("/communities/roomdelta/posts").json()]
    assert post_a.json()["id"] not in ids_b, "Room A posts must not appear in room B"


def test_room_a_tags_absent_from_room_b_filter(client):
    owner_a = create_user(client, preferred_username="aowner3")
    owner_b = create_user(client, preferred_username="bowner3")
    room_a = _create_community(client, _token(owner_a), "roomepsilon")
    room_b = _create_community(client, _token(owner_b), "roomzeta")
    m = create_user(client, preferred_username="zetamember")
    r = client.post(f"/communities/roomzeta/join", headers=_auth(_token(m)))
    assert r.status_code == 200
    requests = client.get("/communities/roomzeta/requests", headers=_auth(_token(owner_b))).json()
    rid = next(x["id"] for x in requests if x["username"] == "zetamember")
    client.post(f"/communities/roomzeta/requests/{rid}/approve", headers=_auth(_token(owner_b)))

    post_a = _make_post(client, _token(owner_a), room_a["id"], title="t", body="b", tags=["kotlin"])
    assert post_a.status_code == 200

    leaked = client.get("/communities/roomzeta/posts?tag=kotlin").json()
    assert not any(x["id"] == post_a.json()["id"] for x in leaked), (
        "Tag filtering must not cross room boundaries"
    )
