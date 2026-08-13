"use client";

import { useTranslations } from "next-intl";

export type EditorMode = "write" | "preview" | "split";

export default function EditorToolbar({
  mode,
  onModeChange,
  onBold,
  onItalic,
  onHeader,
  onQuote,
  onCode,
  onList,
  onLink,
  onPickImage,
  uploading,
}: {
  mode: EditorMode;
  onModeChange: (m: EditorMode) => void;
  onBold: () => void;
  onItalic: () => void;
  onHeader: () => void;
  onQuote: () => void;
  onCode: () => void;
  onList: () => void;
  onLink: () => void;
  onPickImage: () => void;
  uploading: boolean;
}) {
  const t = useTranslations();
  const btn =
    "rounded-md px-2 py-1 text-sm text-muted hover:text-text hover:bg-surface2 transition-colors";

  return (
    <div className="flex items-center justify-between border-b border-line px-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={onHeader} className={btn} title={t("ui.toolbarHeader")}>
          <span className="font-semibold">H</span>
        </button>
        <button type="button" onClick={onBold} className={btn} title={`${t("ui.toolbarBold")} (Ctrl+B)`}>
          <span className="font-bold">B</span>
        </button>
        <button type="button" onClick={onItalic} className={btn} title={`${t("ui.toolbarItalic")} (Ctrl+I)`}>
          <span className="italic">I</span>
        </button>
        <button type="button" onClick={onQuote} className={btn} title={t("ui.toolbarQuote")}>
          &ldquo;
        </button>
        <button type="button" onClick={onCode} className={btn} title={t("ui.toolbarCode")}>
          {"</>"}
        </button>
        <button type="button" onClick={onList} className={btn} title={t("ui.toolbarList")}>
          &bull; List
        </button>
        <button type="button" onClick={onLink} className={btn} title={`${t("ui.toolbarLink")} (Ctrl+K)`}>
          Link
        </button>
        <button type="button" onClick={onPickImage} className={btn} title={t("ui.toolbarUpload")} disabled={uploading}>
          {uploading ? t("ui.uploading") : t("ui.toolbarImage")}
        </button>
      </div>

      <div className="flex items-center gap-0.5 bg-surface2 rounded-lg p-0.5">
        {(["write", "preview", "split"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
              mode === m ? "bg-signal text-ink" : "text-muted hover:text-text"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
