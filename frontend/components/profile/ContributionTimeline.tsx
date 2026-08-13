import { useTranslations } from "next-intl";

type Milestone = { label: string; date: string | null };

export default function ContributionTimeline({
  timeline,
  reputationMilestones,
  onLabel,
}: {
  timeline: Milestone[];
  reputationMilestones: Milestone[];
  onLabel: (label: string, threshold?: number) => string;
}) {
  const t = useTranslations();
  return (
    <div>
        <ol className="relative flex flex-col gap-5 before:absolute before:start-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-line">
        {timeline.map((m, i) => {
          const [key, value] = m.label.includes(":")
            ? m.label.split(":")
            : [m.label, undefined];
          return (
            <li key={i} className="relative ps-6">
              <span className="absolute start-0 top-1 h-[11px] w-[11px] rounded-full bg-signal ring-4 ring-surface" />
              <div className="text-sm text-text/90">{onLabel(key, value ? Number(value) : undefined)}</div>
              {m.date && (
                <div className="text-xs text-muted mt-0.5">
                  {new Date(m.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {reputationMilestones.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-xs text-muted mb-2">{t("ui.milestonesReached")}</p>
          <div className="flex flex-wrap gap-2">
            {reputationMilestones.map((m, i) => (
              <span
                key={i}
                className="reply-type-pill bg-signal/10 text-signal border border-signal/20"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
