"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import Avatar from "../../../../components/profile/Avatar";
import StatBlock from "../../../../components/profile/StatBlock";
import CuriosityMap from "../../../../components/profile/CuriosityMap";
import ContributionTimeline from "../../../../components/profile/ContributionTimeline";
import RecentActivity from "../../../../components/profile/RecentActivity";

type Profile = {
  username: string;
  joined_at: string;
  reputation: number;
  helpful_posts: number;
  helpful_comments: number;
  communities: string[];
  topics: { topic: string; count: number; weight: number }[];
  recent_activity: {
    type: "post" | "comment";
    id: string;
    post_id: string;
    title: string | null;
    excerpt: string;
    score: number;
    created_at: string;
  }[];
  timeline: { label: string; date: string | null }[];
  reputation_milestones: { label: string; date: string | null }[];
};

export default function ProfilePage({ params }: { params: { username: string } }) {
  const t = useTranslations();
  const locale = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getProfile(params.username)
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [params.username]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!profile) {
    return <ProfileSkeleton />;
  }

  // Translate a backend milestone label. Dated keys are looked up directly
  // (e.g. profileTimeline.joined); undated reputation keys carry the
  // threshold after a colon (profileTimeline.reputationReached:10) and are
  // rendered with the number interpolated.
  const translateMilestone = (label: string, threshold?: number) => {
    if (threshold !== undefined) {
      try {
        return t("profileTimeline.reputationReached", { threshold }) as string;
      } catch {
        return `${t("profileTimeline.reputationReached")} ${threshold}+`;
      }
    }
    try {
      return t.raw(label) as string;
    } catch {
      return label;
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-6">
      {/* Identity card -- deliberately no banner, no follower counts, no badges. */}
      <div className="rounded-lg border border-line bg-surface card-translucent p-6">
        <div className="flex items-center gap-4">
          <Avatar seed={profile.username} size={56} />
          <div>
            <h1 className="font-display text-xl font-semibold text-text">{profile.username}</h1>
            <p className="text-xs text-muted mt-0.5">
              {t("profile.joined")}{" "}
              {formatDate(locale, profile.joined_at, "monthYear")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-line pt-5">
          <StatBlock label={t("ui.reputation")} value={profile.reputation} />
          <StatBlock label={t("ui.helpfulPosts")} value={profile.helpful_posts} />
          <StatBlock label={t("ui.helpfulComments")} value={profile.helpful_comments} />
        </div>

        {profile.communities.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {profile.communities.map((c) => (
              <span key={c} className="reply-type-pill bg-surface2 text-muted">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <Section title={t("profile.curiosityMapTitle")}>
        <CuriosityMap topics={profile.topics} />
      </Section>

      <Section title={t("profile.timelineTitle")}>
        <ContributionTimeline
          timeline={profile.timeline}
          reputationMilestones={profile.reputation_milestones}
          onLabel={translateMilestone}
        />
      </Section>

      <Section title={t("ui.recentActivity")}>
        <RecentActivity items={profile.recent_activity} locale={locale} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <h2 className="font-display text-sm font-semibold text-muted uppercase tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

// Locale-aware date formatting: uses the viewer's locale for month names
// and ordering instead of the browser default (which ignores the app locale).
function formatDate(
  locale: string,
  iso: string,
  mode: "monthYear" | "full"
): string {
  return new Date(iso).toLocaleDateString(locale.replace("_", "-"),
    mode === "monthYear"
      ? { year: "numeric", month: "long" }
      : { year: "numeric", month: "short", day: "numeric" }
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-4">
          <div className="skeleton h-14 w-14 rounded-full" />
          <div>
            <div className="skeleton h-5 w-32 rounded mb-2" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-line pt-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton h-6 w-10 rounded mb-2" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-6">
          <div className="skeleton h-3 w-28 rounded mb-4" />
          <div className="skeleton h-3 w-full rounded mb-2" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}
