"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import PostEditor from "../../../components/editor/PostEditor";
import { Button } from "../../../components/ui/Button";
import TagInput from "../../../components/editor/TagInput";
import { useDraft } from "../../../hooks/useDraft";
import { useUnsavedChangesWarning } from "../../../hooks/useUnsavedChangesWarning";

type Community = { id: string; name: string; description: string; is_default?: boolean };

type Draft = {
  communityId: string;
  title: string;
  body: string;
  topics: string[];
  tags: string[];
};

const EMPTY_DRAFT: Draft = { communityId: "", title: "", body: "", topics: [], tags: [] };

export default function CreatePostPage() {
  const router = useRouter();
  const t = useTranslations();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { value: draft, setValue: setDraft, restored, dismissRestored, clearDraft } = useDraft<Draft>(
    "thoughtdom:draft:new-post",
    EMPTY_DRAFT
  );

  const isDirty = !submitted && (draft.title.trim() !== "" || draft.body.trim() !== "");
  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    // Only General and communities the viewer has joined may receive a post;
    // the backend enforces this anyway, but surfacing it here stops viewers
    // from drafting into a room they can't write to.
    api.listCommunities().then(async (cs) => {
      setCommunities(cs);
      const joined = await joinedIds(cs);
      // A saved draft may target a community the viewer is no longer in --
      // drop back to General, then the first joined room, in that order.
      const defaultCommunity = cs.find((c: Community) => c.is_default);
      const fallback = defaultCommunity?.id || joined[0] || "";
      setDraft((d) =>
        d.communityId && joined.includes(d.communityId)
          ? d
          : { ...d, communityId: fallback }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinedIds(all: Community[]): Promise<string[]> {
    try {
      const results = await Promise.all(
        all.map((c) => api.getMembership(c.id).catch(() => null))
      );
      return results
        .map((m, i) => (m && (m.is_member || m.is_general) ? all[i].id : null))
        .filter((id): id is string => id !== null);
    } catch {
      return [];
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const post = await api.createPost({
        community_id: draft.communityId,
        title: draft.title,
        body: draft.body,
        topics: draft.topics.join(", ") || undefined,
        tags: draft.tags.length > 0 ? draft.tags : undefined,
      });
      setSubmitted(true);
      clearDraft();
      router.push(`/post/${post.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">{t("create.createTitle")}</h1>
        {restored && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dismissRestored();
            }}
            className="rounded-full animate-fade-in-up"
          >
            {t("create.draftRestored")}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="create-community" className="text-sm text-muted block mb-1">
              {t("create.community")}
            </label>
            <select
              id="create-community"
              value={draft.communityId}
              onChange={(e) => setDraft((d) => ({ ...d, communityId: e.target.value }))}
              className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
            >
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="create-title" className="text-sm text-muted block mb-1">
            {t("create.titleLabel")}
          </label>
          <input
            id="create-title"
            required
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>

        <div>
          {/* Not a <label>: it heads a composite editor (textarea + toolbar +
              topics), not one form control, so there's nothing single to
              associate it with via htmlFor. */}
          <p className="text-sm text-muted mb-1">{t("create.yourIdea")}</p>
          <PostEditor
            body={draft.body}
            onBodyChange={(body) => setDraft((d) => ({ ...d, body }))}
            topics={draft.topics}
            onTopicsChange={(topics) => setDraft((d) => ({ ...d, topics }))}
          />
          <p className="text-xs text-muted/70 mt-1.5">
            {t("create.topicsHint")}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted mb-1">{t("create.tags")}</p>
          <TagInput tags={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
          <p className="text-xs text-muted/70 mt-1.5">
            {t("create.tagsHint")}
          </p>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !draft.body.trim() || !draft.title.trim()}
          className="w-full"
        >
          {loading ? t("ui.posting") : t("create.post")}
        </Button>
      </form>
    </div>
  );
}
