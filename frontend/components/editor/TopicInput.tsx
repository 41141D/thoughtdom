import { useTranslations } from "next-intl";
import { useState } from "react";
import { suggestTopics } from "../../lib/topicSuggestions";

export default function TopicInput({
  topics,
  onChange,
}: {
  topics: string[];
  onChange: (topics: string[]) => void;
}) {
  const t = useTranslations();
  const [input, setInput] = useState("");
  const suggestions = suggestTopics(input, topics);

  function addTopic(topic: string) {
    const trimmed = topic.trim();
    if (!trimmed) return;
    if (topics.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      return;
    }
    if (topics.length >= 6) return; // matches the backend's cap of 6 topics per post
    onChange([...topics, trimmed]);
    setInput("");
  }

  function removeTopic(topic: string) {
    onChange(topics.filter((t) => t !== topic));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTopic(input);
    } else if (e.key === "Backspace" && input === "" && topics.length > 0) {
      removeTopic(topics[topics.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface2 border border-line px-2.5 py-2 focus-within:border-signal transition-colors">
        {topics.map((topic) => (
          <span
            key={topic}
            className="reply-type-pill bg-signal/15 text-signal flex items-center gap-1"
          >
            {topic}
            <button
              type="button"
              onClick={() => removeTopic(topic)}
              className="hover:text-danger transition-colors"
              aria-label={t("ui.removeTag", { tag: topic })}
            >
              ×
            </button>
          </span>
        ))}
        {topics.length < 6 && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={topics.length === 0 ? t("ui.topicPlaceholder") : t("ui.addAnother")}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-surface shadow-lg overflow-hidden animate-fade-in-up">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTopic(s)}
              className="block w-full px-3 py-1.5 text-sm text-text/90 hover:bg-surface2 transition-colors text-start"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
