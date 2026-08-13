# ThoughtDom — Run It Locally

Follow these steps after unzipping `thoughtdom_final.zip` (e.g. to your Desktop). No Supabase account is needed to start — the app works fully with local defaults.

---

## 1. Prerequisites

You need two things installed on your machine:

| Tool | Version | Get it from |
|---|---|---|
| Python | 3.11+ | https://www.python.org/downloads |
| Node.js | 20+ | https://nodejs.org |

After installing Node, also install pnpm (Next.js uses it):

```
npm install -g pnpm
```

**Windows tip:** when extracting the zip, put it in a short path like `C:\td\` instead of deep inside OneDrive/Desktop. Long file paths cause Windows errors (this was actually the cause of your earlier "invalid zip" scare).

---

## 2. Start the backend (Terminal 1)

Open a terminal, go to the backend folder, create a virtual environment, install dependencies, and start the API:

**Windows PowerShell:**

```
cd C:\td\thoughtdom\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set DATABASE_URL=sqlite:///./thoughtdom.db
set CORS_ORIGINS=http://localhost:3000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Mac/Linux:**

```
cd /path/to/thoughtdom/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="sqlite:///./thoughtdom.db"
export CORS_ORIGINS="http://localhost:3000"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

What happens: the server creates a local SQLite database (`thoughtdom.db`) automatically, runs migrations, and prints at startup: `Media storage: LOCAL FALLBACK (./uploads)` — that's expected and good. Leave this terminal running.

The API is now at **http://localhost:8000**. You can check it in a browser at `http://localhost:8000/health`.

---

## 3. Start the frontend (Terminal 2)

Open a second terminal:

```
cd C:\td\thoughtdom\frontend
pnpm install
pnpm dev
```

(`pnpm install` runs once and takes a few minutes. Only needed the first time.)

The site is now live at **http://localhost:3000/en** (also `/ku` and `/ar`).

---

## 4. Try it

1. Go to `http://localhost:3000/en/register` — create an anonymous account (any username + password).
2. Go to `/en/create` — post an idea in the **general** community.
3. Switch languages with **EN / KU / ع** in the navbar — Kurdish and Arabic render right-to-left.
4. Run the backend test suite anytime: `cd backend && pytest tests` (14 tests).

---

## 5. Optional: use your real Supabase later

When you're ready to deploy, copy `backend/.env.example` to `backend/.env` and fill in the real values (see the deployment checklist in `FINAL_REPORT.md`). The backend automatically switches from local SQLite to Supabase Postgres and from local file storage to Supabase Storage when those values are present. Nothing else changes.

## Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Make sure the venv is activated (`.\.venv\Scripts\activate` on Windows) |
| `pnpm: command not found` | `npm install -g pnpm` |
| Port 8000 or 3000 already in use | Change the port in the uvicorn / `pnpm dev --port 3001` commands |
| Red "Redis unavailable" warning at startup | Harmless for local use — rate limiting is dev-only |
| Images don't persist across restarts | Local uploads are stored in `backend/uploads/` — don't delete it |
