import { useTranslations } from "next-intl";
import { UploadedImage } from "../../hooks/useImageUpload";

export default function ImageStrip({
  images,
  onRemove,
}: {
  images: UploadedImage[];
  onRemove: (id: string, markdown: string) => void;
}) {
  const t = useTranslations();
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2.5 border-t border-line bg-surface2/40">
      {images.map((img) => (
        <div key={img.id} className="group relative animate-fade-in-up">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.thumbnailUrl}
            alt=""
            className="h-16 w-16 object-cover rounded-lg border border-line"
          />
          <button
            type="button"
            onClick={() => onRemove(img.id, img.markdown)}
            className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-danger text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title={t("ui.removeImage")}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
