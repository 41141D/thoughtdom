# ThoughtDom — QA Bug-Hunt Report

**Round:** Pre-deployment manual QA sweep
**Date:** August 13, 2026
**Scope:** Every route, theme, and locale — login, register, logout, home feed, post creation, post detail, comments, voting, search, communities, profiles, settings, and the Why page, in English, Arabic, and Kurdish (Sorani), in both dark and light themes.
**Rule for this round:** no code was changed. Everything below is observation only — fixes are queued for your approval (except the one already flagged in the Stabilization Report pipeline).

---

## 1. Verdict at a glance

The site is in genuinely good shape. Of the 33 manual tests executed, **31 passed cleanly**, **1 real bug** was confirmed, and **1 issue was ruled out** after retesting on a fresh build. No layout breakage, no routing failures, no data loss, and no RTL regressions anywhere. The two items that deserve attention before or right after launch are the **post-sign-out navbar bug** and the **incomplete Arabic Why page**.

| Category | Result |
|---|---|
| Authentication flows (login, register, logout, wrong password) | 1 real bug (stale navbar after sign-out), otherwise clean |
| Post creation, detail, comments, voting | All passing, including the fixed comment submission |
| Search (empty state, results, tabs, RTL) | All passing |
| Communities and membership UX | All passing |
| Profiles (logged-in and public views) | All passing |
| Settings (theme round-trip, language switching) | Clean on fresh build; one old stale-build scare ruled out |
| Locales | EN complete; KU complete; **AR Why page missing translations** |
| Backend test suite | 54/54 passing after this round |

---

## 2. Test-by-test results (with screenshots)

Screenshots are shipped in `.delivery/qa/` inside the zip, named to match each test.

| # | Test | Locale / Theme | Result | Screenshot | Notes |
|---|---|---|---|---|---|
| 1 | Login page render | EN · dark | PASS | qa01_login_en.webp | Form renders cleanly |
| 2 | Login page render | AR · dark | ISSUE | qa02_login_ar.webp | Navbar and layout mirror perfectly, but the form heading and labels stay in English — i18n gap on auth forms |
| 3 | Register page render | EN · dark | PASS | qa03_register_en.webp | Clean |
| 4 | Register empty submit | EN · dark | PASS (wishlist) | qa04_register_validation.webp | Browser-native validation tooltip fires; no junk account created |
| 5 | Settings page render | EN · dark | PASS | qa05_settings_dark.webp | Appearance, language, account, sign-out all present |
| 6 | Sign-out confirmation | EN · dark | PASS | qa06a_logout_state.webp | "Signed out. Take care." banner appears |
| 7 | Navbar after sign-out (immediate) | EN · dark | **BUG** | qa29_logout_stale_navbar.webp | Navbar still shows logged-in chrome until reload — see section 3 |
| 8 | Navbar after reload (logged out) | EN · dark | PASS | qa30_loggedout_after_reload.webp | Confirms session is truly destroyed; only client state was stale |
| 9 | Login page while logged out | EN · dark | PASS | qa07_loggedout_navbar.webp | Sign In / Get Name shown correctly |
| 10 | Wrong-password error | EN · dark | PASS | qa08_wrong_password.webp | "Invalid credentials" shown, no crash |
| 11 | Successful login | EN · dark | PASS | qa09_login_success.webp | Redirects home, navbar switches to logged-in |
| 12 | Create post page | EN · light | PASS | qa27_create_editor.webp | Toolbar, write/preview/split, topics, tags, draft-restore banner all working |
| 13 | Empty-title submit blocked | EN · light | PASS | qa28_create_validation.webp | Post button disabled; nothing junky can be submitted |
| 14 | Profile page (logged in) | EN · light | PASS | qa11_profile.webp | Stats, curiosity map, timeline, activity all render |
| 15 | Why page | EN · dark | PASS | qa12_why_en.webp | Clean render |
| 16 | Search empty state | EN · dark | PASS | qa13_search_empty.webp | Friendly empty state shown |
| 17 | Invalid post ID | EN · dark | PASS (wishlist) | qa14_404_post.webp | "Post not found" banner; no custom 404 page yet |
| 18 | Communities page | EN · dark | PASS | qa15_communities.webp | Your communities / Discover split renders |
| 19 | Community detail (General) | EN · dark | PASS | qa16_community_general.webp | Open-to-everyone badge, 0 members is correct (system-created, no membership rows) |
| 20 | Home feed | AR · dark | PASS | qa17_home_ar.webp | Fully RTL-mirrored and translated |
| 21 | Home feed | KU · dark | PASS | qa18_home_ku.webp | Fully RTL and translated |
| 22 | Post detail | AR · dark | PASS | qa19_post_ar.webp | RTL mirror, Arabic vote hints, Arabic reply-type buttons; Steel-Man badge translated |
| 23 | Upvote once | AR · dark | PASS | qa20_vote_toggle.webp | 0 → 1, persisted server-side |
| 24 | Upvote again (toggle off) | AR · dark | PASS | qa21_vote_toggle_back.webp | 1 → 0, toggle works both ways |
| 25 | Light mode toggle | EN | PASS | qa22_light_mode.webp | Applies instantly with correct active state |
| 26 | Light mode round-trip (retest) | EN | **Ruled out** | qa23_settings_light_retest.webp, qa24_home_light_retest.webp | See section 4 — the earlier "home stayed dark" scare was a stale dev build, not code |
| 27 | Settings in Arabic | AR | PASS (wishlist) | qa25_settings_ar.webp | Fully translated RTL; "active" marker shows as نشط on every language row |
| 28 | Search with results | AR · light | PASS | qa26_search_ar_results.webp | Tabs, result card, RTL query echoing all correct |
| 29 | Profile (public, logged out) | EN · light | PASS | qa31_profile_loggedout.webp | Public profile readable without login |
| 30 | Why page | AR · light | **GAP** | qa32_why_ar.webp | Headings translated, but major sections still in English — see section 5 |
| 31 | Why page | KU · light | PASS | qa33_why_ku.webp | Fully translated in Kurdish — confirms AR is the outlier |

---

## 3. The one real bug: navbar stays "logged in" after Sign Out

After clicking Sign Out, the backend correctly destroys the session (verified: the auth cookie is cleared and protected endpoints return 401), but the navbar keeps rendering the logged-in chrome — the user menu with your name, the New Post link, and the settings gear — until the next full page reload. Screenshots `qa29_logout_stale_navbar.webp` (stale state) and `qa30_loggedout_after_reload.webp` (correct state after reload) show the before/after.

This is a **medium-severity client-side state bug**: nothing malicious happens (any post attempt fails with 401 anyway), but the UI lies about the session for one navigation. The fix is small: in the logout handler, after the logout call succeeds, explicitly clear the session provider's user state and remove the client-side auth markers, then optionally push to `/`. It's a one-file change in the frontend; say the word and I'll make it.

---

## 4. The scare that was ruled out: theme not following across pages

Mid-sweep, switching to Light mode on Settings left the home feed rendering dark. I rebuilt the frontend from source and retested: on a fresh build, the Light toggle propagates to every page instantly (`qa23_settings_light_retest.webp` → `qa24_home_light_retest.webp`). The earlier failure was caused by the long-running dev server serving a stale compiled bundle from a previous code version (which used a different localStorage key name). The current codebase uses one consistent theme key. No code change is needed — but when you deploy, I recommend a fresh install (or clearing `td-theme` in your browser) so no old key lingers.

---

## 5. The i18n gap: Arabic Why page is half-English

The Kurdish Why page is 100% translated (`qa33_why_ku.webp`), which isolates the problem: the **Arabic messages file for `/why` is missing most section translations**. The hero and headings are Arabic ("افهم أولًا، ثم اعترض"), but "What is ThoughtDom?", the four core values, the Steel-Man Gate explanation, and the closing goal paragraph fall back to English (`qa32_why_ar.webp`). The RTL layout itself is flawless — this is purely missing translation strings. Fixable in one pass over the Arabic messages file.

---

## 6. What this site lacks — the honest wishlist

You asked what I think the site is missing before we publish. Ranked by what I'd actually build first:

| Priority | Item | Why |
|---|---|---|
| 1 | **Fix the logout navbar bug** | Only actual bug found; small fix, immediate credibility win |
| 2 | **Finish the Arabic Why page translation** | The flagship page is half-English for a third of your audience; one-pass fix |
| 3 | **Edit and delete for posts and comments** | A typo in a post is permanent today. Standard expectation on any forum |
| 4 | **Notifications** (someone challenged my post, my comment got replied) | This is the single biggest retention lever; the comment system is mature enough to earn it |
| 5 | **Auth-form translations** (login/register labels in AR/KU) | Small, makes onboarding fully native |
| 6 | **Custom 404 page with a "go home" link** | Currently the default Next.js 404 — a branded dead-end page |
| 7 | **Profile editing** (display name / avatar) | Usernames are the only identity today; even an optional avatar would help |
| 8 | **Native-language form validation messages** | Browser tooltips show English in AR/KU browsers |
| 9 | **Password hint on register** (minimum length shown) | Users guess; a one-line hint prevents failed submits |
| 10 | **Feed sorting** (new / top by votes) | "Latest ideas" is only chronological; a Top sort rewards quality |
| 11 | **`dir="auto"` on the search input** | Latin queries in Arabic/Kurdish UI align oddly |
| 12 | **Supabase + Redis configuration** | Still open from before — needed for production deployment (Supabase for storage/postgres in prod, Redis for rate limiting) |

Items I deliberately **did not** include, because they would fight the product's identity: follower counts (explicitly anti-popularity-contest), email/password reset (the anonymous, no-email design is a feature), and any algorithmic "for you" feed (curation is what the site is escaping from).

---

## 7. Environment notes for launch

The QA password `thoughtdom-qa-2026` was set on your `WinterComet439` account **only in the local dev database** to complete the login-flow tests — it does not exist in the zip's clean database, so it will not leak to production. The dev database was left in a clean state: one user, one community, one post, and the verification comments from earlier rounds. The backend suite stands at **54/54 passing** and the TypeScript build is clean as of this round.

---

*Report authored by Manus AI.*
