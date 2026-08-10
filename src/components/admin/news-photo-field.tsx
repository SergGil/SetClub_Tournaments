"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressPhotoFile } from "@/lib/image-compress";
import { ALLOWED_PHOTO_CONTENT_TYPES, MAX_PHOTO_BYTES, PHOTO_UPLOAD_HINT } from "@/lib/validation/photo";

/**
 * Presigns and PUTs straight to R2, same "browser -> R2 direct" flow as
 * PhotoUploadDialog (see docs/PHOTOS.md) - a news post's cover photo is
 * uploaded before the surrounding form is even submitted, both because
 * there's no post id yet to key it by and because routing the file through
 * the create/update Server Action would hit Next's default 1MB body limit.
 */
async function uploadNewsPhoto(file: File): Promise<{ key?: string; error?: string }> {
  const presignRes = await fetch("/api/news/photo-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, contentLength: file.size }),
  });
  if (!presignRes.ok) {
    const body = (await presignRes.json().catch(() => null)) as { error?: string } | null;
    return { error: body?.error ?? "Не вдалося підготувати завантаження" };
  }
  const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

  const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!putRes.ok) {
    return { error: "Не вдалося завантажити файл у сховище" };
  }
  return { key };
}

/**
 * `photoKey` - "" when nothing new was uploaded (the post's existing photo,
 * if any, stays as-is). `removePhoto` - "true" only when the admin
 * explicitly cleared an existing photo without picking a replacement; the
 * two together let the Server Action tell "unchanged" apart from "cleared"
 * without needing to know the old key itself.
 */
export function NewsPhotoField({ initialPhotoUrl }: { initialPhotoUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(initialPhotoUrl ?? null);
  const [key, setKey] = useState("");
  const [removed, setRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    const allowedTypes: readonly string[] = ALLOWED_PHOTO_CONTENT_TYPES;
    if (!allowedTypes.includes(file.type)) {
      setError("Непідтримуваний формат файлу");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Файл завеликий (>${MAX_PHOTO_BYTES / (1024 * 1024)} МБ)`);
      return;
    }

    setUploading(true);
    const compressed = await compressPhotoFile(file);
    const result = await uploadNewsPhoto(compressed);
    setUploading(false);
    if (result.error || !result.key) {
      setError(result.error ?? "Не вдалося завантажити фото");
      return;
    }
    setKey(result.key);
    setPreview(URL.createObjectURL(compressed));
    setRemoved(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="news-photo">Фото</Label>
      {preview && (
        <div className="flex items-center gap-3">
          {/* Deliberately a plain <img>, not next/image: shows either a
              freshly picked file via a local blob: URL (next/image can't
              optimize that) or the existing photo, kept consistent by using
              the same element for both. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-20 w-32 rounded-md object-cover" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPreview(null);
              setKey("");
              setRemoved(true);
              setError(null);
            }}
            disabled={uploading}
          >
            <XIcon /> Прибрати фото
          </Button>
        </div>
      )}
      <input
        id="news-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-sm file:font-medium"
      />
      <p className="text-xs text-muted-foreground">{PHOTO_UPLOAD_HINT}</p>
      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Завантаження…
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input type="hidden" name="photoKey" value={key} />
      <input type="hidden" name="removePhoto" value={removed ? "true" : "false"} />
    </div>
  );
}
