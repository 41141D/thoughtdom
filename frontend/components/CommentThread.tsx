"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import VoteButtons from "./VoteButtons";
import ReplyForm from "./ReplyForm";
import { renderMarkdown } from "../lib/markdown";

export type Comment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_username: string;
  reply_type: "neutral" | "agree" | "challenge";
  steelman_text: string | null;
  steelman_passed: boolean | null;
  steelman_status: "passed" | "needs_improvement" | "failed" | null;
  steelman_feedback: string | null;
  body: string;
  score: number;
  my_vote: number | null;
  created_at: string;
};

type CommentNode = Comment & { children: CommentNode[] };

const PILL_STYLES: Record<string, string> = {
  agree: "bg-agree/15 text-agree",
  challenge: "bg-challenge/15 text-challenge",
  neutral: "bg-surface2 text-muted",
};

// Depth beyond which a branch auto-collapses on first render, so one long
// back-and-forth doesn't push everything else off the page.
const AUTO_COLLAPSE_DEPTH = 3;
// Indentation stops growing past this depth -- deep threads flatten
// visually instead of marching off the right edge on mobile.
const MAX_VISUAL_DEPTH = 4;

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];

  byId.forEach((node) => {
    if (node.parent_comment_id && byId.has(node.parent_comment_id)) {
      byId.get(node.parent_comment_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function countDescendants(node: CommentNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

export default function CommentThread({
  postId,
  comments,
  onChanged,
}: {
  postId: string;
  comments: Comment[];
  onChanged: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const tree = useMemo(() => buildTree(comments), [comments]);

  if (tree.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface/50 p-6 text-center text-sm text-muted">
        {t("ui.noReplies")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tree.map((node) => (
        <CommentNodeView key={node.id} node={node} postId={postId} depth={0} onChanged={onChanged} />
      ))}
    </div>
  );
}

function CommentNodeView({
  node,
  postId,
  depth,
  onChanged,
}: {
  node: CommentNode;
  postId: string;
  depth: number;
  onChanged: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(depth >= AUTO_COLLAPSE_DEPTH && node.children.length > 0);
  const [replying, setReplying] = useState(false);
  const hiddenCount = collapsed ? countDescendants(node) : 0;
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  return (
    <div
      className="animate-fade-in-up"
      style={
        visualDepth > 0
          ? { marginInlineStart: 14, paddingInlineStart: 14, borderInlineStart: "2px solid #d8d3c8" }
          : undefined
      }
    >
      <div className="rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line/80">
        <div className="flex items-center gap-2 mb-2">
          <span className={`reply-type-pill ${PILL_STYLES[node.reply_type]}`}>{node.reply_type}</span>
          {node.reply_type === "challenge" && node.steelman_status && node.steelman_status !== "passed" && (
            <span className="reply-type-pill bg-danger/15 text-danger" title={node.steelman_feedback || undefined}>
              {node.steelman_status === "needs_improvement" ? t("gate.heldShort") : t("gate.failedShort")}
            </span>
          )}
          <Link href={`/u/${node.author_username}`} className="text-xs text-muted hover:text-signal transition-colors">
            {node.author_username}
          </Link>
          <span className="text-xs text-muted">&middot;</span>
          <span className="text-xs text-muted">{new Date(node.created_at).toLocaleDateString()}</span>

          {node.children.length > 0 && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="ms-auto text-xs text-muted hover:text-signal transition-colors flex items-center gap-1"
            >
              <span className={`inline-block transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
              {collapsed ? `${countDescendants(node)} ${t("ui.hidden")}` : t("ui.collapse")}
            </button>
          )}
        </div>

        {node.reply_type === "challenge" && node.steelman_text && (
          <p className="steelman-mirror mb-2 text-sm">&ldquo;{node.steelman_text}&rdquo;</p>
        )}

        <div className="prose text-sm text-text/90">{renderMarkdown(node.body)}</div>

        <div className="mt-2.5 flex items-center gap-4">
          <VoteButtons targetType="comment" targetId={node.id} score={node.score} myVote={node.my_vote} size="sm" />
          <button
            onClick={() => setReplying((r) => !r)}
            className="text-xs text-muted hover:text-signal transition-colors"
          >
            {replying ? t("ui.cancel") : t("ui.reply")}
          </button>
        </div>

        {replying && (
          <div className="mt-3 animate-fade-in-up">
            <ReplyForm
              postId={postId}
              parentCommentId={node.id}
              autoFocus
              compact
              onCancel={() => setReplying(false)}
              onPosted={async () => {
                setReplying(false);
                setCollapsed(false);
                await onChanged();
              }}
            />
          </div>
        )}
      </div>

      {!collapsed && node.children.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {node.children.map((child) => (
            <CommentNodeView key={child.id} node={child} postId={postId} depth={depth + 1} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
