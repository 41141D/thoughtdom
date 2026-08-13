import { useTranslations } from "next-intl";

type TopicStat = { topic: string; count: number; weight: number };

export default function CuriosityMap({ topics }: { topics: TopicStat[] }) {
  const t = useTranslations();
  if (topics.length === 0) {
    return (
      <div className="text-sm text-muted leading-relaxed">{t("ui.curiosityMapEmpty")}</div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {topics.map((t) => (
        <div key={t.topic} className="flex items-center gap-3">
          <span className="text-sm text-text/90 capitalize w-36 shrink-0 truncate">{t.topic}</span>
          <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
            <div
              className="h-full rounded-full bg-signal transition-all duration-700 ease-out"
              style={{ width: `${Math.max(t.weight * 100, 6)}%` }}
            />
          </div>
          <span className="text-xs text-muted w-6 text-end shrink-0">{t.count}</span>
        </div>
      ))}
    </div>
  );
}
