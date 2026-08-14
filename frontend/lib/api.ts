// Cookie-only authentication. The session JWT lives in the HttpOnly
// `td_token` cookie set by the backend. The browser frontend NEVER reads or
// stores the token; every request authenticates via `credentials: "include"`.
// The backend retains Bearer support strictly for legacy/non-browser clients.

// Same-origin API proxy in production: vercel.json rewrites every
// `/api/:path*` request on this site to the Render backend. This makes the
// session cookie FIRST-PARTY -- Chrome blocks third-party cookies by default
// since 2025, which silently broke cross-domain cookie auth for most users
// even with SameSite=None. Local dev keeps using NEXT_PUBLIC_API_URL
// (e.g. http://localhost:8000) untouched.
const isProdApi = Boolean(process.env.NEXT_PUBLIC_API_URL);
const API_BASE = isProdApi ? "/api" : "";

export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

// ---- Session event bus (in-memory only, never persisted) ----
// The frontend tracks session state in React component state. This tiny bus
// lets the NavBar, pages, and API layer stay in sync without a page reload.

export type SessionEvent = { type: "login"; username: string } | { type: "logout" } | { type: "expired" };

type SessionListener = (event: SessionEvent) => void;

const listeners = new Set<SessionListener>();

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySession(event: SessionEvent): void {
  listeners.forEach((l) => l(event));
}

/**
 * React hook exposing the current session username (null when signed out).
 * Bootstraps from the authoritative `/auth/me` server check and stays in sync
 * with the session event bus -- no localStorage involved, no page reload.
 */
export function useSession(): string | null {
  // Lazy require keeps this module importable from plain .ts helpers.
  const { useEffect, useState } = require("react") as typeof import("react");
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((name) => {
        if (mounted) setUsername(name);
      })
      .catch(() => mounted && setUsername(null));
    return onSessionChange((event) => {
      if (!mounted) return;
      if (event.type === "login") setUsername(event.username);
      else setUsername(null);
    });
  }, []);

  return username;
}

/**
 * Authoritative browser session check. Reads the HttpOnly cookie on the
 * server side and returns the username, or null when not signed in.
 */
export async function getSession(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data?.username ?? null;
  } catch {
    return null;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (res.status === 401) {
    // Cookie missing, revoked, or expired -- the backend session ended;
    // tell the UI immediately so navbars and pages flip to logged-out state.
    notifySession({ type: "expired" });
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;

  return res.json();
}

async function uploadFile(path: string, file: Blob, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: (() => {
      const form = new FormData();
      form.append("file", file, filename);
      return form;
    })(),
  });

  if (res.status === 401) {
    notifySession({ type: "expired" });
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  register: (password: string, preferred_username?: string) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        password,
        preferred_username,
      }),
    }),

  login: (username: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
      }),
    }),

  logout: () =>
    request("/auth/logout", { method: "POST" }),

  listCommunities: () =>
    request("/communities/"),

  getCommunity: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}`),

  createCommunity: (data: { name: string; description?: string }) =>
    request("/communities/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ---- Community leadership & membership ----

  getMembership: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/membership`),

  joinCommunity: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/join`, { method: "POST" }),

  leaveCommunity: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/leave`, { method: "POST" }),

  listJoinRequests: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/requests`),

  approveRequest: (idOrName: string, requestId: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/requests/${requestId}/approve`, {
      method: "POST",
    }),

  rejectRequest: (idOrName: string, requestId: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/requests/${requestId}/reject`, {
      method: "POST",
    }),

  removeMember: (idOrName: string, username: string) =>
    request(
      `/communities/${encodeURIComponent(idOrName)}/members/${encodeURIComponent(username)}`,
      { method: "DELETE" }
    ),

  listMembers: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/members`),

  listCommunityReports: (idOrName: string) =>
    request(`/communities/${encodeURIComponent(idOrName)}/reports`),

  updateCommunitySettings: (idOrName: string, data: { description?: string }) =>
    request(`/communities/${encodeURIComponent(idOrName)}/settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listCommunityPosts: (idOrName: string, tag?: string) =>
    request(
      `/communities/${encodeURIComponent(idOrName)}/posts${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`
    ),

  listPosts: (communityId?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (communityId) params.set("community_id", communityId);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    return request(`/posts/${qs ? `?${qs}` : ""}`);
  },

  // ---- Search (respects community visibility: room posts surface only
  // for members; general posts are public to logged-out visitors too) ----

  searchPosts: (q: string, page = 1, limit = 20) => {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return request(`/search/posts?${params.toString()}`);
  },

  searchCommunities: (q: string, limit = 20) => {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("limit", String(limit));
    return request(`/search/communities?${params.toString()}`);
  },

  getPost: (id: string) =>
    request(`/posts/${id}`),

  createPost: (data: {
    community_id: string;
    title: string;
    body: string;
    topics?: string;
    tags?: string[];
  }) =>
    request("/posts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTags: (communityId?: string) =>
    request(`/tags/${communityId ? `?community_id=${encodeURIComponent(communityId)}` : ""}`),

  getProfile: (username: string) =>
    request(`/users/${encodeURIComponent(username)}`),

  listComments: (postId: string) =>
    request(`/comments/post/${postId}`),

  createComment: (data: {
    post_id: string;
    parent_comment_id?: string | null;
    reply_type: "neutral" | "agree" | "challenge";
    steelman_text?: string;
    body: string;
  }) =>
    request("/comments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Revise the steelman_text of a challenge comment held at
  // needs_improvement. Re-evaluation returns a new verdict and feedback.
  steelmanRevise: (commentId: string, steelmanText: string) =>
    request(`/comments/${encodeURIComponent(commentId)}/steelman`, {
      method: "PATCH",
      body: JSON.stringify({ steelman_text: steelmanText }),
    }),

  vote: (
    target_type: "post" | "comment",
    target_id: string,
    value: number
  ) =>
    request("/votes", {
      method: "POST",
      body: JSON.stringify({
        target_type,
        target_id,
        value,
      }),
    }),

  uploadImage: (file: Blob, filename: string) =>
    uploadFile("/media/image", file, filename),
};

