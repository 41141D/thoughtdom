"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";

type ReplyType = "neutral" | "agree" | "challenge";

export default function ReplyForm({
  postId,
  parentCommentId = null,
  autoFocus = false,
  compact = false,
  onPosted,
  onCancel,
}: {
  postId: string;
  parentCommentId?: string | null;
  autoFocus?: boolean;
  compact?: boolean;
  onPosted: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [replyType, setReplyType] = useState<ReplyType>("neutral");
  const [steelman, setSteelman] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  // Held steelman attempt awaiting revision -- the form stays open so the
  // author can improve their restatement instead of facing a dead end.
  const [heldComment, setHeldComment] = useState<{
    id: string;
    verdict: "needs_improvement" | "failed";
    feedback: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations();
  const steelmanId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.createComment({
        post_id: postId,
        parent_comment_id: parentCommentId,
        reply_type: replyType,
        steelman_text: replyType === "challenge" ? steelman : undefined,
        body,
      });
      if (replyType === "challenge" && data?.steelman_status === "needs_improvement") {
        // The gate held the challenge for revision: keep the form open with
        // the private feedback so the author can try again (the comment is
        // saved privately, visible only to them).
        setHeldComment({
          id: data.id,
          verdict: "needs_improvement",
          feedback: data.steelman_feedback || "",
        });
      } else {
        setBody("");
        setSteelman("");
        setReplyType("neutral");
        setHeldComment(null);
        await onPosted();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevise(e: React.FormEvent) {
    e.preventDefault();
    if (!heldComment) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.steelmanRevise(heldComment.id, steelman);
      if (data?.steelman_status === "passed") {
        setBody("");
        setSteelman("");
        setReplyType("neutral");
        setHeldComment(null);
        await onPosted();
      } else {
        setHeldComment({
          id: heldComment.id,
          verdict: data?.steelman_status === "needs_improvement"
            ? "needs_improvement"
            : "failed",
          feedback: data?.steelman_feedback || "",
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={heldComment ? handleRevise : handleSubmit}
      className={`rounded-lg border border-line bg-surface flex flex-col gap-3 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex gap-2">
        {(["neutral", "agree", "challenge"] as const).map((type) => (
          <button
            type="button"
            key={type}
            onClick={() => setReplyType(type)}
            className={`reply-type-pill border transition-colors ${
              replyType === type ? "border-signal text-signal" : "border-line text-muted hover:text-text"
            }`}
          >
            {t(`challenge.${type}`)}
          </button>
        ))}
      </div>

      {heldComment ? (
        <div className="rounded-lg border border-challenge bg-surface2 p-3 animate-fade-in-up">
          <p className="text-xs font-semibold text-challenge uppercase tracking-wide mb-1">
            {heldComment.verdict === "needs_improvement"
              ? t("gate.heldTitle")
              : t("gate.failedTitle")}
          </p>
          <p className="text-sm text-text/90 mb-2">{heldComment.feedback}</p>
          <label htmlFor={steelmanId} className="text-xs text-muted block mb-1">
            {t("gate.reviseHint")}
          </label>
          <textarea
            id={steelmanId}
            required
            rows={2}
            value={steelman}
            onChange={(e) => setSteelman(e.target.value)}
            placeholder={t("ui.steelmanPlaceholder")}
            className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm outline-none focus:border-challenge transition-colors"
          />
        </div>
      ) : replyType === "challenge" ? (
        <div className="animate-fade-in-up">
          <label htmlFor={steelmanId} className="text-xs text-challenge block mb-1">
            First, restate the argument you&apos;re disagreeing with, fairly &mdash; this has to
            pass a fairness check before your challenge can post.
          </label>
          <textarea
            id={steelmanId}
            required
            rows={2}
            value={steelman}
            onChange={(e) => setSteelman(e.target.value)}
            placeholder={t("ui.steelmanPlaceholder")}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-challenge transition-colors"
          />
        </div>
      ) : null}

      <textarea
        required
        autoFocus={autoFocus}
        rows={compact ? 2 : 3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("ui.replyPlaceholder")}
        className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal transition-colors resize-none"
      />

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? t("ui.posting") : heldComment ? t("gate.revise") : t("ui.reply")}
        </Button>
        {onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel}>
            {t("ui.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
