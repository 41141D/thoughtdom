"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api, useSession } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";

type Community = {
  id: string;
  name: string;
  description: string;
  creator_username: string | null;
  post_count: number;
  member_count: number;
  is_default: boolean;
  created_at: string;
  is_member: boolean | null;
  role: "owner" | "moderator" | "member" | null;
};

export default function CommunitiesPage() {
  const t = useTranslations();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const viewer = useSession();

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setCommunities(null);
    api
      .listCommunities()
      .then(setCommunities)
      .catch((e) => setError(e.message));
  }

  const loading = communities === null && !error;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold">{t("communities.title")}</h1>
          <p className="text-muted text-xs mt-0.5">{t("communities.subtitle")}</p>
        </div>
        {viewer && (
          <Button
            variant={showCreate ? "secondary" : "primary"}
            size="sm"
            onClick={() => setShowCreate((s) => !s)}
          >
            {showCreate ? t("ui.cancel") : t("communities.createCommunity")}
          </Button>
        )}
      </div>

      {showCreate && (
        <CreateCommunityForm
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3"           aria-busy="true" aria-label={t("communities.loading")}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-4">
              <div className="skeleton h-5 w-32 rounded mb-2" />
              <div className="skeleton h-3.5 w-2/3 rounded mb-3" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      )}

      {communities && communities.length > 0 && (
        <CommunitySections communities={communities} />
      )}
    </div>
  );
}

function CommunitySections({ communities }: { communities: Community[] }) {
  const t = useTranslations();
  // "Your communities" = rooms the viewer belongs to (roles or membership
  // rows). General stays out: it is open to everyone and would clutter the
  // section for every signed-in visitor.
  const mine = communities.filter((c) => c.role !== null);
  const rest = communities.filter((c) => c.role === null);

  return (
    <div className="flex flex-col gap-8">
      {mine.length > 0 && (
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            {t("communities.yours")}
          </h2>
          <div className="flex flex-col gap-3">
            {mine.map((c, i) => (
              <CommunityCard key={c.id} community={c} delay={i * 45} />
            ))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            {t("communities.discover")}
          </h2>
          <div className="flex flex-col gap-3">
            {rest.map((c, i) => (
              <CommunityCard key={c.id} community={c} delay={i * 45} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CommunityCard({ community, delay }: { community: Community; delay: number }) {
  const t = useTranslations();
  const memberCount = Math.max(community.member_count, 0);
  return (
    <Link
      href={`/community/${community.name}`}
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in-up group block rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-signal hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-display font-semibold text-lg leading-snug text-text group-hover:text-signal transition-colors capitalize">
          {community.name}
        </h2>
        {community.is_default && (
          <span className="reply-type-pill bg-surface2 text-muted">{t("communities.default")}</span>
        )}
        {community.role === "owner" && (
          <span className="reply-type-pill bg-signal/10 text-signal">{t("communities.youOwn")}</span>
        )}
        {community.role === "moderator" && (
          <span className="reply-type-pill bg-surface2 text-muted">{t("communities.moderatorRole")}</span>
        )}
      </div>
      {community.description && (
        <p className="user-content text-sm text-muted mt-1 line-clamp-2 leading-relaxed">
          {community.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>{t("communities.postsCount", { count: community.post_count })}</span>
        <span>&middot;</span>
        <span>{t("communities.membersCount", { count: memberCount })}</span>
        <span>&middot;</span>
        <span>{t("communities.createdBy", { creator: community.creator_username || "ThoughtDom" })}</span>
        <span>&middot;</span>
        <span>{new Date(community.created_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}

function CreateCommunityForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createCommunity({ name, description });
      setName("");
      setDescription("");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in-up rounded-lg border border-line bg-surface p-4 mb-6 flex flex-col gap-3"
    >
      <div>
        <label htmlFor="new-community-name" className="text-sm text-muted block mb-1">
          {t("communities.name")}
        </label>
        <input
          id="new-community-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("communities.namePlaceholder")}
          className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <p className="text-xs text-muted/70 mt-1">{t("communities.nameRules")}</p>
      </div>

      <div>
        <label htmlFor="new-community-description" className="text-sm text-muted block mb-1">
          {t("communities.description")}
        </label>
        <textarea
          id="new-community-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t("ui.whatIsCommunity")}
          className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal resize-none"
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !name.trim()}
        size="sm"
      >
        {loading ? t("ui.creating") : t("ui.create")}
      </Button>
    </form>
  );
}
