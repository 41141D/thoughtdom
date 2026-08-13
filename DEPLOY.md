# ThoughtDom — Deployment Guide (Supabase + Render + Vercel)

Everything below is already wired up in the code. This guide is the human checklist for the three platforms.

---

## Step 1 — Supabase (database + image storage)

Done (migrated by you via SQL Editor on Aug 13, 2026):

- [x] All 11 tables created (`users`, `communities`, `posts`, `comments`, `votes`, `tags`, `post_tags`, `community_memberships`, `membership_requests`, `reports`, `media_assets`)
- [x] Storage bucket `post-images` created, **private** (no public access)
- [x] Upload + signed-URL retrieval verified working

Remaining one-time tasks (optional but recommended):

1. **Create the `general` community seed** — register the first real user on the live site; the backend auto-seeds `general` on first boot, so this happens automatically on the first Render deploy.
2. **After deployment, rotate secrets** — Supabase dashboard: Settings → Database → *Reset password*, and Settings → API → regenerate the `service_role` key. Old keys shared in chat become useless.

## Step 2 — Render (backend)

1. Log in to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (or use *Deploy from external source → Docker image* after pushing an image)
3. Settings:
   - **Runtime:** Docker
   - **Plan:** Free (spins down after ~15 min idle; wakes on request, ~30–50 s)
   - **Region:** closest to you
4. **Environment variables** (Render dashboard → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:<NEW_PASSWORD>@db.nznnifbqjejkquoqtuej.supabase.co:5432/postgres?sslmode=require` |
| `JWT_SECRET` | 32+ random characters (NOT `dev-secret-change-me`) |
| `SUPABASE_URL` | `https://nznnifbqjejkquoqtuej.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |
| `CORS_ORIGINS` | `https://thought-dom.vercel.app` (update after Vercel deploy; add `http://localhost:3000` for local dev) |
| `REDIS_URL` | Render Redis instance (New → Redis → free, then copy its Internal/External URL; use the **External** URL) |

5. Deploy. On first boot the backend creates nothing new (tables exist) and seeds the `general` community automatically.
6. Verify: `https://<backend>.onrender.com/health` → `{"status":"ok"}`

## Step 3 — Vercel (frontend)

1. Push the code to GitHub (the `thoughtdom` folder = the repo root; `.gitignore` is included)
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo
3. Framework Preset: **Next.js**, Root Directory: `frontend`
4. **Environment variable:**

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend>.onrender.com` |

5. Deploy. Done.

## Step 4 — Final wiring

- Update `CORS_ORIGINS` on Render to include the Vercel URL (e.g. `https://thought-dom.vercel.app`)
- Re-deploy Render (env var changes trigger a redeploy)
- End-to-end test on the live site: register → post → upload image → logout → login again

---

## Post-launch security rotation (do this right after first successful deploy)

1. Supabase: reset DB password, regenerate service_role key, update Render env vars, redeploy
2. Delete the old keys from anywhere they were shared (including this chat history)

## Privacy posture (verified in code)

- Database stores **only** username + hashed password + user content. No IP, no email, no location, no device data.
- Server logs record **no client IPs** (`log_config.ini` suppresses uvicorn access logs).
- Redis rate-limit counters are keyed by IP but are in-memory, transient (60 s–1 h TTL), and never persisted.
- The JWT lives in an HttpOnly cookie only; the frontend never holds or logs it.
