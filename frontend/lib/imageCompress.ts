const MAX_DIMENSION = 2400;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  const longest = Math.max(width, height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // fall back to the original if canvas isn't available
  ctx.drawImage(bitmap, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      outputType,
      outputType === "image/jpeg" ? QUALITY : undefined
    );
  });
}
