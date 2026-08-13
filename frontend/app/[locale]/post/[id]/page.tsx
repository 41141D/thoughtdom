"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { api, useSession } from "../../../../lib/api";
import VoteButtons from "../../../../components/VoteButtons";
import ReplyForm from "../../../../components/ReplyForm";
import { Button } from "../../../../components/ui/Button";
import { primaryLink } from "../../../../components/ui/Button";
import CommentThread, { Comment } from "../../../../components/CommentThread";
import { renderMarkdown } from "../../../../lib/markdown";

type Post = {
  id: string;
  community_id: string;
  community_name: string;
  author_username: string;
  title: string;
  body: string;
  tags: string[];
  score: number;
  my_vote: number | null;
  created_at: string;
};

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations();
  const viewer = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [membership, setMembership] = useState<{
    is_member: boolean;
    is_general: boolean;
  } | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const [p, c] = await Promise.all([api.getPost(params.id), api.listComments(params.id)]);
    setPost(p);
    setComments(c);
  }

  async function refreshMembership(communityId: string) {
    try {
      setMembership(await api.getMembership(communityId));
    } catch {
      setMembership(null);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    // Once the post loads, learn whether the viewer may reply to it:
    // General is open to all signed-in users; user-created communities
    // require membership. The backend is the real boundary -- this only
    // shapes the UI so viewers see an actionable prompt instead of a 403.
    if (post?.community_id) {
      refreshMembership(post.community_id);
    }
  }, [post?.community_id]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>
    );
  }

  if (!post || comments === null) {
    return <PostDetailSkeleton />;
  }

  return (
    <div>
      <div className="rounded-lg border border-line bg-surface p-5 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-2 text-xs text-muted mb-2">
          <Link href={`/u/${post.author_username}`} className="hover:text-signal transition-colors">
            {post.author_username}
          </Link>
          <span>&middot;</span>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <h1 className="font-display text-2xl font-semibold leading-snug">{post.title}</h1>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {post.tags.map((t) => (
              <span key={t} className="reply-type-pill capitalize bg-surface2 text-muted">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="prose text-sm text-text/90 mt-3">{renderMarkdown(post.body)}</div>
        <div className="mt-4 flex items-center gap-3">
          <VoteButtons targetType="post" targetId={post.id} score={post.score} myVote={post.my_vote} />
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">
        {t("post.repliesCount", { count: comments.length })}
      </h2>

      <div className="mb-6">
        <CommentThread postId={post.id} comments={comments} onChanged={refresh} />
      </div>

      {membership === null ? (
        <ReplyForm postId={post.id} onPosted={refresh} />
      ) : membership.is_general || membership.is_member ? (
        <ReplyForm postId={post.id} onPosted={refresh} />
      ) : viewer ? (
        // Logged in but not a member of this community's room: join first.
        <div className="rounded-lg border border-line bg-surface p-4 animate-fade-in-up">
          <p className="text-sm text-muted mb-3">{t("membership.joinToReply")}</p>
          <JoinButton communityId={post.community_id} onJoined={() => refreshMembership(post.community_id!)} />
        </div>
      ) : (
        // Signed-out viewers of a community post are invited to sign in.
        <div className="rounded-lg border border-line bg-surface p-4 animate-fade-in-up">
          <p className="text-sm text-muted mb-3">{t("membership.signInToReply")}</p>
          <Link href="/login" className={primaryLink}>
            {t("nav.signIn")}
          </Link>
        </div>
      )}
    </div>
  );
}

function PostDetailSkeleton() {
  return (
    <div>
      <div className="rounded-lg border border-line bg-surface p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-3 rounded-full" />
          <div className="skeleton h-3 w-14 rounded" />
        </div>
        <div className="skeleton h-7 w-3/4 rounded mb-3" />
        <div className="skeleton h-4 w-full rounded mb-1.5" />
        <div className="skeleton h-4 w-full rounded mb-1.5" />
        <div className="skeleton h-4 w-2/3 rounded mb-4" />
        <div className="skeleton h-4 w-16 rounded" />
      </div>
      <div className="skeleton h-5 w-24 rounded mb-3" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-14 rounded" />
            </div>
            <div className="skeleton h-3.5 w-full rounded mb-1.5" />
            <div className="skeleton h-4 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function JoinButton({ communityId, onJoined }: { communityId: string; onJoined: () => void }) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleJoin(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.joinCommunity(communityId);
      setDone(true);
      onJoined();
    } finally {
      setLoading(false);
    }
  }

  return done ? (
    <span className="reply-type-pill bg-agree/15 text-agree">{t("membership.joinRequestSent")}</span>
  ) : (
    <Button size="sm" disabled={loading} onClick={handleJoin}>
      {loading ? t("ui.posting") : t("membership.join")}
    </Button>
  );
}
