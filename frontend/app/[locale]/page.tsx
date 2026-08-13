"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import PostCardSkeleton from "../../components/PostCardSkeleton";
import { primaryLink } from "../../components/ui/Button";

type Post = {
  id: string;
  author_username: string;
  community_name: string;
  title: string;
  body: string;
  tags: string[];
  score: number;
  created_at: string;
};

type TagCount = { name: string; post_count: number };

export default function FeedPage() {
  const t = useTranslations();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");
  const [availableTags, setAvailableTags] = useState<TagCount[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    api.listTags().then(setAvailableTags).catch(() => {
      // Filter row is a nice-to-have -- if it fails to load, the feed
      // itself should still render fine without it.
    });
  }, []);

  useEffect(() => {
    setPosts(null);
    api
      .listPosts(undefined, activeTag || undefined)
      .then(setPosts)
      .catch((e) => setError(e.message));
  }, [activeTag]);

  const loading = posts === null && !error;

  return (
    <div>
      <Hero />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-semibold">{t("feed.feedTitle")}</h1>
        <p className="text-muted text-xs">{t("feed.subtitle")}</p>
      </div>

      {availableTags.length > 0 && (
        <TagFilterRow tags={availableTags} activeTag={activeTag} onSelect={setActiveTag} />
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={t("communities.loadingPosts")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      )}

      {posts && posts.length === 0 && !error && <EmptyFeed />}

      {posts && posts.length > 0 && (
        <div className="flex flex-col gap-3">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} delay={i * 45} />
          ))}
        </div>
      )}
    </div>
  );
}

function TagFilterRow({
  tags,
  activeTag,
  onSelect,
}: {
  tags: TagCount[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 -mx-0.5 px-0.5">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 reply-type-pill transition-colors ${
          activeTag === null ? "bg-signal text-ink" : "bg-surface2 text-muted hover:text-text"
        }`}
      >
        {t("communities.all")}
      </button>
      {tags.map((tag) => (
        <button
          key={tag.name}
          onClick={() => onSelect(tag.name)}
          className={`shrink-0 reply-type-pill capitalize transition-colors ${
            activeTag === tag.name ? "bg-signal text-ink" : "bg-surface2 text-muted hover:text-text"
          }`}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}

function Hero() {
  const t = useTranslations();
  return (
    <div className="rounded-lg border border-line p-5 mb-8 relative overflow-hidden">
      <div className="reply-type-pill inline-block bg-challenge/15 text-challenge mb-3">
        {t("feed.steelmanGate")}
      </div>
      <h2 className="font-display text-xl font-semibold leading-snug mb-1.5">
        {t("feed.gateHeading")}
      </h2>
      <p className="text-sm text-muted max-w-md leading-relaxed">{t("feed.gateBody")}</p>
    </div>
  );
}

function PostCard({ post, delay }: { post: Post; delay: number }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Link
      href={`/post/${post.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group block rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-signal hover:shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
        <span>{post.author_username}</span>
        <span>&middot;</span>
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
      </div>
      <h2 className="font-display font-semibold text-lg leading-snug text-text group-hover:text-signal transition-colors">
        {post.title}
      </h2>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {post.community_name && (
          /* Inner <a> navigates to the community; stopPropagation prevents the
             card's outer Link from also navigating (nested <a> is invalid HTML,
             so this is a plain anchor rather than a nested Link). */
          <a
            href={`/${locale}/community/${post.community_name}`}
            onClick={(e) => e.stopPropagation()}
            className="reply-type-pill capitalize bg-signal/15 text-signal hover:bg-signal/25 transition-colors"
          >
            {post.community_name}
          </a>
        )}
        {post.tags &&
          post.tags.map((t) => (
            <span key={t} className="reply-type-pill capitalize bg-surface2 text-muted">
              {t}
            </span>
          ))}
      </div>
      <p className="user-content text-sm text-muted mt-1.5 line-clamp-2 leading-relaxed">{post.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-signal font-medium">{post.score} {t("ui.points")}</div>
        <span className="text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          {t("communities.readMore")}
        </span>
      </div>
    </Link>
  );
}

function EmptyFeed() {
  const t = useTranslations();
  return (
    <div className="animate-fade-in-up rounded-lg border border-dashed border-line bg-surface/50 p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-signal/10 text-signal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>
      <h3 className="font-display font-semibold text-text mb-1">{t("feed.emptyTitle")}</h3>
      <p className="text-sm text-muted mb-5 max-w-xs mx-auto leading-relaxed">
        {t("feed.emptyBody", { community: t("communities.thisCommunity") })}
      </p>
      <Link
        href="/create"
        className={primaryLink}
      >
        {t("communities.postFirstIdea")}
      </Link>
    </div>
  );
}
