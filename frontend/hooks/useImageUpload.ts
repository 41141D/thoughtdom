import { useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { compressImage } from "../lib/imageCompress";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type UploadedImage = {
  id: string;
  url: string;
  thumbnailUrl: string;
  markdown: string;
};

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState("");

  async function uploadFiles(files: File[]): Promise<string[]> {
    const accepted = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (accepted.length === 0) {
      if (files.length > 0) setError("Only PNG, JPEG, and WEBP images are supported.");
      return [];
    }

    setUploading(true);
    setError("");
    const snippets: string[] = [];

    try {
      for (const file of accepted) {
        const compressed = await compressImage(file);
        const asset = await api.uploadImage(compressed, file.name);
        const url = mediaUrl(asset.url);
        const thumbnailUrl = mediaUrl(asset.thumbnail_url || asset.url);
        const markdown = `![](${asset.url})`;
        setImages((prev) => [...prev, { id: asset.id, url, thumbnailUrl, markdown }]);
        snippets.push(markdown);
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }

    return snippets;
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  return { uploading, images, error, uploadFiles, removeImage, setImages };
}
