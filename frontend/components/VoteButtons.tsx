"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "../lib/api";

export default function VoteButtons({
  targetType,
  targetId,
  score,
  myVote,
  size = "md",
}: {
  targetType: "post" | "comment";
  targetId: string;
  score: number;
  myVote: number | null | undefined;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState<number>(myVote ?? 0);
  const [pending, setPending] = useState(false);

  async function cast(value: number) {
    if (pending) return;
    const nextValue = localVote === value ? 0 : value; // clicking an active vote clears it
    const delta = nextValue - localVote;
    setLocalVote(nextValue);
    setLocalScore((s) => s + delta);
    setPending(true);
    try {
      await api.vote(targetType, targetId, nextValue);
    } catch {
      // not signed in, or rate-limited -- roll back optimistic update
      setLocalVote(localVote);
      setLocalScore((s) => s - delta);
    } finally {
      setPending(false);
    }
  }

  const btn = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={`flex items-center gap-1.5 ${btn}`}>
      <button
        onClick={() => cast(1)}
        aria-label={t("votes.upvote")}
        aria-pressed={localVote === 1}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          localVote === 1 ? "text-agree bg-agree/10" : "text-muted hover:text-agree"
        }`}
      >
        ▲
      </button>
      <span className={`font-medium min-w-[1.5ch] text-center ${localVote !== 0 ? "text-signal" : "text-muted"}`}>
        {localScore}
      </span>
      <button
        onClick={() => cast(-1)}
        aria-label={t("votes.downvote")}
        aria-pressed={localVote === -1}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          localVote === -1 ? "text-danger bg-danger/10" : "text-muted hover:text-danger"
        }`}
      >
        ▼
      </button>
    </div>
  );
}
