import { useTranslations } from "next-intl";
import { useState } from "react";
import { suggestTags } from "../../lib/tagSuggestions";

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;

export default function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const t = useTranslations();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const suggestions = suggestTags(input, tags);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) {
      setError("");
      setInput("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(t("ui.maxTags", { count: MAX_TAGS }));
      return;
    }
    if (trimmed.length > MAX_TAG_LENGTH) {
      setError(t("ui.maxTagLen", { count: MAX_TAG_LENGTH }));
      return;
    }
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("ui.tagAlreadyAdded"));
      setInput("");
      return;
    }
    setError("");
    onChange([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
    setError("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface2 border border-line px-2.5 py-2 focus-within:border-signal transition-colors">
          {tags.map((tag) => (
            <span
              key={tag}
              className="reply-type-pill bg-signal/15 text-signal flex items-center gap-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-danger transition-colors"
                aria-label={t("ui.removeTag", { tag })}
              >
                ×
              </button>
            </span>
          ))}
          {tags.length < MAX_TAGS && (
            <div className="flex flex-1 min-w-[160px] items-center gap-1.5">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={handleKeyDown}
                maxLength={MAX_TAG_LENGTH}
                placeholder={tags.length === 0 ? t("ui.tagPlaceholder") : t("ui.addAnother")}
                className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => addTag(input)}
                disabled={!input.trim()}
                className="text-xs font-medium text-signal disabled:text-muted/40 transition-colors px-1.5"
              >
                {t("ui.add")}
              </button>
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-surface shadow-lg overflow-hidden animate-fade-in-up">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addTag(s)}
                className="block w-full px-3 py-1.5 text-sm text-text/90 hover:bg-surface2 transition-colors text-start"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
