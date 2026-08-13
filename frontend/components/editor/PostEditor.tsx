import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";
import { useImageUpload } from "../../hooks/useImageUpload";
import EditorToolbar, { EditorMode } from "./EditorToolbar";
import ImageStrip from "./ImageStrip";
import TopicInput from "./TopicInput";

const WORDS_PER_MINUTE = 200;

export default function PostEditor({
  body,
  onBodyChange,
  topics,
  onTopicsChange,
}: {
  body: string;
  onBodyChange: (v: string) => void;
  topics: string[];
  onTopicsChange: (v: string[]) => void;
}) {
  const [mode, setMode] = useState<EditorMode>("write");
  const [dragActive, setDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations();
  const { uploading, images, error: uploadError, uploadFiles, removeImage } = useImageUpload();

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      onBodyChange(body + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + text + body.slice(end);
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  }

  function wrapSelection(before: string, after: string = before, placeholder = "text") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  }

  function prefixLines(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = body.indexOf("\n", end);
    const block = body.slice(lineStart, lineEnd === -1 ? body.length : lineEnd);
    const prefixed = block
      .split("\n")
      .map((l) => (l.startsWith(marker) ? l : `${marker}${l}`))
      .join("\n");
    const next = body.slice(0, lineStart) + prefixed + body.slice(lineEnd === -1 ? body.length : lineEnd);
    onBodyChange(next);
    requestAnimationFrame(() => el.focus());
  }

  async function handleFiles(files: FileList | File[]) {
    const snippets = await uploadFiles(Array.from(files));
    snippets.forEach((s) => insertAtCursor(`\n${s}\n`));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === "b") {
      e.preventDefault();
      wrapSelection("**");
    } else if (e.key === "i") {
      e.preventDefault();
      wrapSelection("*");
    } else if (e.key === "k") {
      e.preventDefault();
      wrapSelection("[", "](url)", "link text");
    }
  }

  function handleRemoveImage(id: string, markdown: string) {
    removeImage(id);
    onBodyChange(body.replace(`\n${markdown}\n`, "\n").replace(markdown, ""));
  }

  const showWrite = mode === "write" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";

  return (
    <div className="rounded-lg border border-line bg-surface overflow-hidden">
      <EditorToolbar
        mode={mode}
        onModeChange={setMode}
        onBold={() => wrapSelection("**")}
        onItalic={() => wrapSelection("*")}
        onHeader={() => prefixLines("## ")}
        onQuote={() => prefixLines("> ")}
        onCode={() => wrapSelection("\n```\n", "\n```\n", "code")}
        onList={() => prefixLines("- ")}
        onLink={() => wrapSelection("[", "](url)", "link text")}
        onPickImage={() => fileInputRef.current?.click()}
        uploading={uploading}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className={`relative grid ${showWrite && showPreview ? "grid-cols-2 divide-x divide-line" : "grid-cols-1"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/90 border-2 border-dashed border-signal rounded-b-lg pointer-events-none">
            <p className="text-signal font-medium">{t("ui.dropImages")}</p>
          </div>
        )}

        {showWrite && (
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={t("ui.writePlaceholder")}
            rows={14}
            className="w-full resize-none bg-transparent px-4 py-3.5 text-sm leading-relaxed outline-none placeholder:text-muted/60"
          />
        )}

        {showPreview && (
          <div className="prose px-4 py-3.5 text-sm min-h-[280px] overflow-y-auto">
            {body.trim() ? (
              renderMarkdown(body)
            ) : (
              <p className="text-muted/60 italic">{t("ui.noPreview")}</p>
            )}
          </div>
        )}
      </div>

      <ImageStrip images={images} onRemove={handleRemoveImage} />

      {uploadError && <p className="px-4 py-2 text-xs text-danger border-t border-line">{uploadError}</p>}

      <div className="flex items-center justify-between px-4 py-2 border-t border-line text-xs text-muted">
        <span>
          {body.length.toLocaleString()} {t("ui.characters")} &middot; {wordCount.toLocaleString()} {t("ui.words")} &middot;{" "}
          {readingMinutes} {t("ui.minRead")}
        </span>
        <span className="hidden sm:inline">Ctrl+B bold &middot; Ctrl+I italic &middot; Ctrl+K link</span>
      </div>

      <div className="px-4 pb-4">
        <TopicInput topics={topics} onChange={onTopicsChange} />
      </div>
    </div>
  );
}
