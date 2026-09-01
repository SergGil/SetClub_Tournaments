import { apiRequest } from '@/lib/api';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function guessContentType(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_CONTENT_TYPES[ext] ?? 'image/jpeg';
}

/**
 * Presign-then-PUT flow, same as the web's PhotoUploadDialog/NewsPhotoField
 * (docs/PHOTOS.md): ask one of the existing `/api/*photo-presign` routes for
 * a one-time upload URL + object key, PUT the file bytes straight to R2 (not
 * through our own server), and hand the resulting `key` back to the caller
 * to confirm (POST /api/v1/tournaments/[id]/photos, or a news/menu form's
 * `photoKey` field).
 */
export async function uploadPhotoToR2(
  presignPath: string,
  presignBody: Record<string, unknown>,
  file: { uri: string; mimeType?: string | null; fileName?: string | null },
): Promise<{ key: string }> {
  const response = await fetch(file.uri);
  const blob = await response.blob();
  const contentType = guessContentType(file.uri, file.mimeType);
  const fileName = file.fileName ?? file.uri.split('/').pop() ?? 'photo.jpg';

  const { uploadUrl, key } = await apiRequest<{ uploadUrl: string; key: string }>(presignPath, {
    method: 'POST',
    body: { ...presignBody, fileName, contentType, contentLength: blob.size },
  });

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    throw new Error('Не вдалося завантажити фото - спробуйте ще раз');
  }

  return { key };
}
