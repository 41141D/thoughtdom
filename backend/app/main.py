import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.config import parse_cors_origins, settings
from log_config import LOGGING_CONFIG
from app.database import Base, engine, SessionLocal
from app.models import Community
from app.routers import auth, communities, posts, comments, votes, users, media, tags, memberships, search

# Production hardening: disable the public Swagger/ReDoc/OpenAPI docs.
# They expose the entire API surface (schemas, endpoints, examples) to anyone,
# which is free reconnaissance material for attackers. Keep /health so uptime
# monitors still work. Local dev can re-enable via DEBUG_DOCS=1 if ever needed.
_docs = None if os.environ.get("DEBUG_DOCS", "").lower() in ("1", "true") else False
app = FastAPI(
    title="ThoughtDom API",
    version="0.1.0",
    docs_url=_docs,
    redoc_url=_docs,
    openapi_url=_docs,
    # CRITICAL: never issue 308 redirects (e.g. /posts -> /posts/). The Vercel
    # rewrite proxies /api/* here, and Render's ABSOLUTE 308 redirects dragged
    # browsers cross-origin to onrender.com, dropping the HttpOnly auth cookie
    # on mutating requests (POST 401 bug). Canonical paths are used everywhere
    # in the frontend, so no redirects are needed at all.
    redirect_slashes=False,
)

cors_origins = parse_cors_origins(settings.cors_origins)

if not cors_origins:
    # A genuinely empty CORS_ORIGINS is almost always a config mistake,
    # not an intentional "block everything" choice -- say so loudly at
    # startup instead of letting the API silently reject all browsers.
    raise RuntimeError(
        "CORS_ORIGINS is empty. Set it to a comma-separated list of trusted "
        "frontend origins (e.g. https://thought-dom.vercel.app,http://localhost:3000)."
    )

if "*" in cors_origins:
    raise RuntimeError(
        "CORS_ORIGINS must not contain '*': allow_credentials=True and a "
        "wildcard origin are incompatible. List explicit origins instead."
    )

@app.middleware("http")
async def _internal_slash_rewrite(request: Request, call_next):
    """Zero-redirect tolerance for both slash variants of every API path.

    The Vercel rewrite forwards /api/* here, but Vercel's own routing still
    strips trailing slashes (OPTIONS /api/posts/ -> /api/posts) before the
    rewrite fires. Render must therefore answer BOTH /posts and /posts/ --
    but it must NOT issue an HTTP 308 (an absolute redirect would drag the
    browser cross-origin to onrender.com and drop the HttpOnly cookie).
    Instead this middleware rewrites the path INTERNALLY (no response
    redirect, browser never sees it) so FastAPI routing matches the
    canonical slash form. Static/media paths and health are untouched.
    """
    path = request.scope.get("path", "")
    if (
        path
        and not path.endswith("/")
        and not path.startswith("/media")
        and path != "/health"
        and "." not in path
    ):
        request.scope["path"] = path + "/"
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    # Strict header allowlist: browsers may only send these headers in
    # cross-origin requests. Echoing every requested header (allow_headers=["*"])
    # combined with allow_credentials=True would let any listed origin send
    # arbitrary headers like Authorization or X-Custom-* at will -- acceptable
    # in practice only because credentials are cookie-bound and the origin
    # list is tight, but the allowlist removes the attack surface entirely.
    allow_headers=["Content-Type", "Accept", "X-Requested-With"],
)

app.include_router(auth.router)
app.include_router(communities.router)
app.include_router(posts.router)
app.include_router(comments.router)
app.include_router(votes.router)
app.include_router(users.router)
app.include_router(media.router)
app.include_router(tags.router)
app.include_router(memberships.router)
app.include_router(search.router)


def _migrate_steelman_gate_v2():
    """The Steel-Man Gate v2 (three-outcome evaluator) added two columns to
    `comments`: steelman_status (passed | needs_improvement | failed) and
    steelman_feedback (private guidance shown to the author of pending
    attempts). Same idempotent pattern as _migrate_communities_table -- a
    no-op once the columns exist, safe to leave permanently. Legacy rows
    that passed the old binary gate are marked 'passed' so old challenges
    stay publicly visible.
    """
    inspector = inspect(engine)
    if "comments" not in inspector.get_table_names():
        return
    existing_columns = {col["name"] for col in inspector.get_columns("comments")}
    with engine.begin() as conn:
        if "steelman_status" not in existing_columns:
            conn.execute(text("ALTER TABLE comments ADD COLUMN steelman_status VARCHAR"))
            conn.execute(
                text(
                    "UPDATE comments SET steelman_status = 'passed' "
                    "WHERE steelman_passed = 1"
                )
            )
        if "steelman_feedback" not in existing_columns:
            conn.execute(text("ALTER TABLE comments ADD COLUMN steelman_feedback TEXT"))


def _migrate_fk_cascades():
    """Deletion-safety fix, run once per DB. Two FKs that block or break
    manual deletion through Supabase/psql:

    1. post_tags.post_id -> posts.id: the DB-level default RESTRICT meant
       deleting a post that has tags FAILED (SQLAlchemy's ORM cascade never
       ran because the DB refused the DELETE first). CASCADE on the link
       table only removes tag associations -- safe, since Tags themselves
       are shared taxonomy rows.
    2. comments.post_id -> posts.id: same RESTRICT problem for posts with
       comments. The ORM relationship already declares cascade-delete, but
       the DB-level default would refuse the DELETE before the ORM got to
       run it. Matching the DB constraint to the ORM intent.

    (comments.parent_comment_id keeps RESTRICT: deleting a mid-thread reply
    would orphan its children, which is exactly the kind of silent data
    loss this audit is meant to surface rather than paper over.)
    """
    inspector = inspect(engine)
    if "post_tags" not in inspector.get_table_names():
        return
    with engine.begin() as conn:
        dialect = engine.dialect.name
        for table, col in (("post_tags", "post_id"), ("comments", "post_id")):
            fks = inspector.get_foreign_keys(table)
            for fk in fks:
                if fk["constrained_columns"] != [col] or fk["referred_table"] != "posts":
                    continue
                # SQLite (dev/local) creates unnamed FKs that can't be dropped
                # by name, and it can't ALTER existing constraints at all --
                # cascade on SQLite relies on the ORM/PRAGMA behavior, so we
                # only repair named constraints (Postgres production).
                if dialect != "postgresql" or not fk.get("name"):
                    continue
                constraint = fk["name"]
                conn.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}"))
                conn.execute(
                    text(
                        f"ALTER TABLE {table} ADD CONSTRAINT {constraint} "
                        f"FOREIGN KEY ({col}) REFERENCES posts(id) ON DELETE CASCADE"
                    )
                )
                break


def _migrate_communities_table():
    """Base.metadata.create_all only creates tables that don't exist yet --
    it never ALTERs an existing one. The Communities feature added two
    columns (creator_id, is_default) to a table that may already exist from
    before this feature shipped, so on an existing deployment those columns
    need to be added by hand once. This runs that ALTER TABLE automatically
    (idempotent -- checks first) so a fresh `create_all` and an upgrade of an
    existing database both end up in the same state without a separate
    Alembic setup. Safe to leave in permanently; it's a no-op once the
    columns exist.
    """
    inspector = inspect(engine)
    if "communities" not in inspector.get_table_names():
        return  # brand new DB -- create_all above already made the current shape

    existing_columns = {col["name"] for col in inspector.get_columns("communities")}
    with engine.begin() as conn:
        if "creator_id" not in existing_columns:
            conn.execute(text("ALTER TABLE communities ADD COLUMN creator_id VARCHAR"))
        if "is_default" not in existing_columns:
            # DEFAULT 0/false so every pre-existing row (including "general")
            # starts as non-default; the seed block below then flips
            # "general" specifically back to true.
            default_literal = "0" if settings.database_url.startswith("sqlite") else "false"
            conn.execute(
                text(
                    f"ALTER TABLE communities ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT {default_literal}"
                )
            )


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _migrate_communities_table()
    _migrate_steelman_gate_v2()
    _migrate_fk_cascades()
    os.makedirs(settings.upload_dir, exist_ok=True)
    app.mount("/media/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
    # Seed one default community so the MVP has somewhere to post on first
    # run, and guarantee it stays the one flagged is_default=True. See the
    # roadmap doc, Phase 0: launch into a single niche community, not broad.
    db = SessionLocal()
    try:
        general = db.query(Community).filter(Community.name == "general").first()
        if not general:
            general = Community(
                name="general",
                description="The first ThoughtDom community. Start here.",
                is_default=True,
            )
            db.add(general)
        elif not general.is_default:
            general.is_default = True
        db.commit()
    finally:
        db.close()

    # Configuration report: surfaces misconfiguration immediately instead of
    # letting the first upload or browser request fail mysteriously later.
    from app.config import is_supabase_configured

    if is_supabase_configured():
        print(f"Media storage: Supabase Storage ({settings.supabase_url})")
        if settings.jwt_secret == "dev-secret-change-me":
            print(
                "WARNING: JWT_SECRET still the development default. "
                "NEVER deploy with this value."
            )
    else:
        missing = []
        if not settings.supabase_url:
            missing.append("SUPABASE_URL")
        if not settings.supabase_service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        print(
            f"Media storage: LOCAL FALLBACK ({settings.upload_dir}) -- "
            f"{' and '.join(missing)} not set. Uploads save to disk instead of Supabase."
        )


@app.get("/health")
def health():
    return {"status": "ok"}
