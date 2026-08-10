export const PHOTO_MAX_DIMENSION = 2560;
export const PHOTO_COMPRESS_QUALITY = 0.9;

/**
 * Downscales to PHOTO_MAX_DIMENSION on the long edge and re-encodes as WebP
 * at PHOTO_COMPRESS_QUALITY, client-side (Canvas), before the presigned R2
 * PUT (PhotoUploadDialog/NewsPhotoField) - a phone photo is typically well
 * past 2560px on its long edge already, far more than any screen shows, so
 * this cuts upload size/time substantially with no perceptible quality loss
 * (see docs/PHOTOS.md). This is purely a size optimization, never something
 * that should block an upload: any failure along the way (API unsupported,
 * decode/encode error, or a "compressed" result that isn't actually
 * smaller) falls back to the original file, untouched.
 */
export async function compressPhotoFile(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", PHOTO_COMPRESS_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const newName = `${file.name.replace(/\.[^./\\]+$/, "")}.webp`;
  return new File([blob], newName, { type: "image/webp" });
}
