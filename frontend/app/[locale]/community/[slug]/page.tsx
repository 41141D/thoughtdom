"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import PostCardSkeleton from "../../../../components/PostCardSkeleton";
import { primaryLink } from "../../../../components/ui/Button";
import { useSession } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";

type Community = {
  id: string;
  name: string;
  description: string;
  creator_username: string | null;
  post_count: number;
  member_count: number;
  is_default: boolean;
  created_at: string;
};

type Post = {
  id: string;
  author_username: string;
  title: string;
  body: string;
  tags: string[];
  score: number;
  created_at: string;
};

type TagCount = { name: string; post_count: number };

export default function CommunityPage({ params }: { params: { slug: string } }) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [availableTags, setAvailableTags] = useState<TagCount[]>([]);
  const t = useTranslations();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [membership, setMembership] = useState<{
    is_member: boolean;
    role: string | null;
    pending_request: boolean;
    is_general: boolean;
  } | null>(null);

  function refreshMembership() {
    api.getMembership(params.slug).then(setMembership).catch(() => setMembership(null));
  }

  useEffect(() => {
    refreshMembership();
  }, [params.slug, community]);

  useEffect(() => {
    api
      .getCommunity(params.slug)
      .then(setCommunity)
      .catch((e) => setError(e.message));
  }, [params.slug]);

  useEffect(() => {
    api.listTags(params.slug).then(setAvailableTags).catch(() => {
      // Filter row is a nice-to-have -- ok if this fails silently.
    });
  }, [params.slug]);

  useEffect(() => {
    setPosts(null);
    api
      .listCommunityPosts(params.slug, activeTag || undefined)
      .then(setPosts)
      .catch((e) => setError(e.message));
  }, [params.slug, activeTag]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  const loading = posts === null;

  return (
    <div>
      <div className="rounded-lg border border-line bg-surface p-5 mb-6">
        {community ? (
          <>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold capitalize">{community.name}</h1>
              {community.is_default && (
                <span className="reply-type-pill bg-surface2 text-muted">{t("communities.default")}</span>
              )}
            </div>
            {community.description && (
              <p className="text-sm text-muted mt-1.5 leading-relaxed">{community.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>{t("communities.postsCount", { count: community.post_count })}</span>
              <span>&middot;</span>
              <span>
                {t("communities.membersCount", { count: Math.max(community.member_count, 0) })}
              </span>
              <span>&middot;</span>
              <span>{t("communities.createdBy", { creator: community.creator_username || "ThoughtDom" })}</span>
              <JoinActions
                slug={params.slug}
                isGeneral={community.is_default}
                membership={membership}
                onJoined={refreshMembership}
              />
              {membership?.is_member &&
                membership.role !== "owner" &&
                !community.is_default && (
                  <LeaveButton slug={params.slug} onLeft={refreshMembership} />
                )}
            </div>
            {!community.is_default && membership?.is_member && membership.role && (
              <OwnerPanel
                slug={params.slug}
                role={membership.role as "owner" | "moderator"}
                isOwner={membership.role === "owner"}
              />
            )}
          </>
        ) : (
          <>
            <div className="skeleton h-6 w-40 rounded mb-2" />
            <div className="skeleton h-3.5 w-2/3 rounded" />
          </>
        )}
      </div>

      {availableTags.length > 0 && (
        <TagFilterRow tags={availableTags} activeTag={activeTag} onSelect={setActiveTag} />
      )}

      {loading && (
        <div className="flex flex-col gap-3"         aria-busy="true" aria-label={t("communities.loadingPosts")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      )}

      {posts && posts.length === 0 && (
        <EmptyCommunity
          communityName={community?.name}
          isDefault={community?.is_default || false}
          isMember={membership?.is_member ?? null}
          pendingRequest={membership?.pending_request || false}
        />
      )}

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

function JoinActions({
  slug,
  isGeneral,
  membership,
  onJoined,
}: {
  slug: string;
  isGeneral: boolean;
  membership: { is_member: boolean; role: string | null; pending_request: boolean } | null;
  onJoined: () => void;
}) {
    const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const viewer = useSession();
  if (!viewer) return null;
  if (isGeneral) {
    return <span className="reply-type-pill bg-surface2 text-muted">{t("membership.openToAll")}</span>;
  }
  if (membership === null) {
    return <span className="skeleton h-5 w-20 rounded" aria-hidden="true" />;
  }
  if (membership.is_member) {
    return (
      <span className="reply-type-pill bg-agree/15 text-agree">
        {membership.role === "owner" ? t("membership.youOwner") : t("membership.youMember")}
      </span>
    );
  }
  if (membership.pending_request) {
    return <span className="reply-type-pill bg-surface2 text-muted">{t("membership.requestPending")}</span>;
  }

  async function handleJoin(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.joinCommunity(slug);
      onJoined();
      if (res?.detail && String(res.detail).startsWith("Already a member")) {
        onJoined();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      onClick={handleJoin}
      disabled={loading}
    >
      {loading ? t("ui.posting") : t("membership.join")}
    </Button>
  );
}

function LeaveButton({ slug, onLeft }: { slug: string; onLeft: () => void }) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleLeave(e: React.MouseEvent) {
    e.preventDefault();
    if (!window.confirm(t("membership.leaveConfirm"))) return;
    setLoading(true);
    try {
      await api.leaveCommunity(slug);
      onLeft();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleLeave}
      disabled={loading}
      className="hover:text-danger"
    >
      {t("membership.leave")}
    </Button>
  );
}

function OwnerPanel({
  slug,
  role,
  isOwner,
}: {
  slug: string;
  role: "owner" | "moderator";
  isOwner: boolean;
}) {
  const t = useTranslations();
  const [requests, setRequests] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Owners and moderators both get to see moderation; only owners see the
  // pending-requests queue (approving is an ownership decision).
  // `isOwner` arrives as a prop from the header so the panel doesn't cast.
  const canModerate = isOwner || role === "moderator";
  if (!canModerate) return null;

  useEffect(() => {
    if (isOwner) {
      api.listJoinRequests(slug).then(setRequests).catch(() => setRequests([]));
    }
  }, [slug, isOwner]);

  async function handleDecision(id: string, approve: boolean) {
    setBusy(id);
    try {
      if (approve) await api.approveRequest(slug, id);
      else await api.rejectRequest(slug, id);
      api.listJoinRequests(slug).then(setRequests).catch(() => setRequests([]));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(username: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t("membership.removeConfirm", { username }))) return;
    try {
      await api.removeMember(slug, username);
      // Refresh handled by the caller via onRemoved when re-rendering.
      window.location.reload();
    } catch {
      // Surface through the page error by re-throwing.
      throw new Error("Failed to remove member");
    }
  }

  return (
    <div id="moderation" className="mt-4 rounded-lg border border-line bg-surface2/60 p-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-text">
          {t("membership.moderation")}
        </h3>
        {isOwner && (
          <Link href={`/community/${slug}#moderation`}>
            <span className="reply-type-pill bg-signal/10 text-signal">
              {t("membership.manageCommunity")}
            </span>
          </Link>
        )}
      </div>
      {isOwner && (
        <div className="mb-3">
          <p className="text-xs text-muted mb-1.5">
            {requests.length === 0
              ? t("membership.noRequests")
              : t("membership.pendingCount", { count: requests.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5"
              >
                <span className="text-sm text-text">{r.username}</span>
                <Button
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => handleDecision(r.id, true)}
                  className="bg-agree/15 text-agree hover:bg-agree/25 px-2"
                >
                  {t("membership.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy === r.id}
                  onClick={() => handleDecision(r.id, false)}
                  className="bg-danger/15 hover:bg-danger/25 px-2"
                >
                  {t("membership.reject")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {isOwner && (
        <p className="text-xs text-muted">
          {t("membership.manageHint")}
        </p>
      )}
      {canModerate && !isOwner && (
        <p className="text-xs text-muted">{t("membership.modPerks")}</p>
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

function PostCard({ post, delay }: { post: Post; delay: number }) {
  const t = useTranslations();
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
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {post.tags.map((t) => (
            <span key={t} className="reply-type-pill capitalize bg-surface2 text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
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

function EmptyCommunity({
  communityName,
  isDefault,
  isMember,
  pendingRequest,
}: {
  communityName?: string;
  isDefault: boolean;
  isMember: boolean | null;
  pendingRequest: boolean;
}) {
  const t = useTranslations();
  // The backend is the real boundary: only members may post into a
  // user-created community. The empty-state CTA mirrors that -- a join-first
  // prompt for non-members, the Create Post flow for members/General.
  if (!isDefault && !isMember && !pendingRequest) {
    return (
      <div className="animate-fade-in-up rounded-lg border border-dashed border-line bg-surface/50 p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-signal/10 text-signal">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <h3 className="font-display font-semibold text-text mb-1">{t("communities.joinFirstTitle")}</h3>
        <p className="text-sm text-muted mb-4 max-w-xs mx-auto leading-relaxed">
          {t("communities.joinFirstBody", { community: communityName || t("communities.thisCommunity") })}
        </p>
      </div>
    );
  }
  return (
    <div className="animate-fade-in-up rounded-lg border border-dashed border-line bg-surface/50 p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-signal/10 text-signal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>
      <h3 className="font-display font-semibold text-text mb-1">{t("communities.emptyTitle")}</h3>
      <p className="text-sm text-muted mb-5 max-w-xs mx-auto leading-relaxed">
        {t("communities.emptyBody", { community: communityName || t("communities.thisCommunity") })}
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
