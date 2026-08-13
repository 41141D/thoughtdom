"""Regression test: logout clears the HttpOnly session cookie and the
browser-facing navbar flow relies on /auth/me, never on a frontend-stored
JWT. Verifies the full sign-in -> navbar visible -> sign out -> navbar gone
sequence as the browser would perform it. Runs in-process via the shared
TestClient fixture like the rest of the suite."""


def test_logout_clears_cookie_and_me_returns_401(client):
    # 1. Register -- expect the td_token cookie to be set.
    res = client.post("/auth/register", json={
        "password": "regression-test-pass",
        "preferred_username": None,
    })
    assert res.status_code == 200, res.text
    token_cookie = res.cookies.get("td_token")
    assert token_cookie, "Registration must set the td_token cookie"

    # 2. /auth/me is authoritative: the session cookie authenticates the user.
    res = client.get("/auth/me")
    assert res.status_code == 200
    username = res.json()["username"]

    # 3. Sign out -- the cookie must be deleted.
    res = client.post("/auth/logout")
    assert res.status_code == 200
    assert not res.cookies.get("td_token"), "Logout must clear the td_token cookie"

    # 4. The browser navbar queries /auth/me; it must now be 401.
    res = client.get("/auth/me")
    assert res.status_code == 401, (
        "After logout, /auth/me must return 401 so the navbar flips to logged-out"
    )

    # 5. Re-login must succeed again with a fresh cookie.
    res = client.post("/auth/login", json={
        "username": username,
        "password": "regression-test-pass",
    })
    assert res.status_code == 200
    assert res.cookies.get("td_token"), "Re-login must set a fresh td_token cookie"

    # 6. Cleanup: sign out so the test leaves no dangling session.
    client.post("/auth/logout")


def test_logout_failure_semantics(client):
    """A signed-out user calling logout must not crash and the endpoint
    stays idempotent -- the frontend's 'logout succeeded' path is safe
    either way."""
    # No session cookie at all.
    res = client.post("/auth/logout")
    assert res.status_code == 200
    assert not res.cookies.get("td_token")

    # /auth/me without a cookie stays 401 (no false 'still signed in').
    res = client.get("/auth/me")
    assert res.status_code == 401
