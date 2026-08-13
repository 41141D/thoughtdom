"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type Tab = "posts" | "communities";

type SearchResult = {
  id: string;
  author_username?: string;
  title?: string;
  body?: string;
  topics?: string | null;
  tags?: string[];
  score?: number;
  community_name?: string;
  created_at?: string;
  name?: string;
  description?: string;
  post_count?: number;
  member_count?: number;
  creator_username?: string | null;
  is_default?: boolean;
  is_member?: boolean | null;
  role?: string | null;
};

export default function SearchPage() {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("posts");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Seed the field from the URL so a shared search link restores the query.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") || "";
    setQuery(initial);
  }, []);

  // Debounce: fire the request 250ms after typing stops. A blank query
  // clears the results rather than fetching everything.
  useEffect(() => {
    const timer = setTimeout(() => runSearch(), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeTab]);

  function runSearch() {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);
    const runner =
      activeTab === "posts" ? api.searchPosts(q, 1, 20) : api.searchCommunities(q, 20);
    runner
      .then((rows) => setResults(rows))
      .catch((e: Error) => {
        setResults([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }

  const q = query.trim();
  const showEmpty = results !== null && !loading && results.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-semibold">{t("search.title")}</h1>
          {q && (
            <p className="text-muted text-xs mt-0.5">
              {t("search.resultsFor", { query: q })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <TabPill
            active={activeTab === "posts"}
            onClick={() => setActiveTab("posts")}
            label={t("search.postsTab")}
          />
          <TabPill
            active={activeTab === "communities"}
            onClick={() => setActiveTab("communities")}
            label={t("search.communitiesTab")}
          />
        </div>
      </div>

      {/* The page-level field stays in sync with the nav box: typing here
          also updates the URL so the search is shareable. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }}
        className="mb-5"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.title")}
          autoComplete="off"
          className="w-full rounded-md bg-surface border border-line px-3.5 py-2 text-sm text-text placeholder:text-muted/70 outline-none focus:border-signal"
        />
      </form>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger mb-4">
          {t("search.error", { error })}
        </div>
      )}

      {loading && (
        <div aria-busy="true" aria-label={t("search.searching")} className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <div className="skeleton h-5 w-40 rounded mb-2" />
              <div className="skeleton h-3.5 w-2/3 rounded mb-3" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && showEmpty && q && (
        <div className="rounded-lg border border-dashed border-line bg-surface/50 p-10 text-center">
          <p className="text-sm text-muted">{t("search.noResults", { query: q })}</p>
        </div>
      )}

      {!loading && !showEmpty && results && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((r, i) =>
            activeTab === "posts" ? (
              <PostRow key={r.id} result={r} delay={i * 40} t={t} />
            ) : (
              <CommunityRow key={r.id} result={r} delay={i * 40} t={t} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`reply-type-pill transition-colors ${
        active ? "bg-signal text-ink" : "bg-surface2 text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function PostRow({
  result,
  delay,
  t,
}: {
  result: SearchResult;
  delay: number;
  t: (key: string, args?: Record<string, string | number>) => string;
}) {
  return (
    <Link
      href={`/post/${result.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group block rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-signal hover:shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
        <span>{result.author_username}</span>
        {result.community_name && (
          <>
            <span>&middot;</span>
            <span className="capitalize">{result.community_name}</span>
          </>
        )}
        {result.created_at && (
          <>
            <span>&middot;</span>
            <span>{new Date(result.created_at).toLocaleDateString()}</span>
          </>
        )}
        <span className="text-signal font-medium ms-auto">
          {t("search.postScore", { count: result.score ?? 0 })}
        </span>
      </div>
      <h2 className="font-display font-semibold text-lg leading-snug text-text group-hover:text-signal transition-colors">
        {result.title}
      </h2>
      <p className="user-content text-sm text-muted mt-1 line-clamp-2 leading-relaxed">{result.body}</p>
    </Link>
  );
}

function CommunityRow({
  result,
  delay,
  t,
}: {
  result: SearchResult;
  delay: number;
  t: (key: string, args?: Record<string, string | number>) => string;
}) {
  const memberCount = Math.max(result.member_count ?? 0, 0);
  return (
    <Link
      href={`/community/${result.name}`}
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group block rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-signal hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display font-semibold text-lg leading-snug text-text group-hover:text-signal transition-colors capitalize">
          {result.name}
        </h2>
        {result.is_default && (
          <span className="reply-type-pill bg-surface2 text-muted">{t("communities.default")}</span>
        )}
        {result.role === "owner" && (
          <span className="reply-type-pill bg-signal/10 text-signal">{t("communities.youOwn")}</span>
        )}
        {result.role === "moderator" && (
          <span className="reply-type-pill bg-surface2 text-muted">{t("communities.moderatorRole")}</span>
        )}
        {result.is_member && !result.role && (
          <span className="reply-type-pill bg-agree/15 text-agree">{t("membership.youMember")}</span>
        )}
      </div>
      {result.description && (
        <p className="user-content text-sm text-muted mt-1 line-clamp-2 leading-relaxed">{result.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>{t("communities.postsCount", { count: result.post_count ?? 0 })}</span>
        <span>&middot;</span>
        <span>{t("communities.membersCount", { count: memberCount })}</span>
        <span>&middot;</span>
        <span>
          {t("communities.createdBy", { creator: result.creator_username || "ThoughtDom" })}
        </span>
      </div>
    </Link>
  );
}
