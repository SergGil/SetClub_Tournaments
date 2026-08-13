import { z } from "zod";

export const ALLOWED_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Generous ceiling for a phone photo - only guards against runaway uploads,
// not a quality/compression concern (see docs/PHOTOS.md).
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const MAX_PHOTO_FILENAME_LENGTH = 200;

/** Shown next to the file picker in both PhotoUploadDialog and NewsPhotoField, so the limits below stay in sync with what's actually enforced. */
export const PHOTO_UPLOAD_HINT = `JPEG, PNG, WEBP · до ${MAX_PHOTO_BYTES / (1024 * 1024)} МБ · назва файлу — до ${MAX_PHOTO_FILENAME_LENGTH} символів`;

export const presignRequestSchema = z.object({
  tournamentId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(MAX_PHOTO_FILENAME_LENGTH),
  contentType: z.enum(ALLOWED_PHOTO_CONTENT_TYPES),
  // Bounds what createPresignedUploadUrl actually signs (see src/lib/r2.ts) -
  // MAX_PHOTO_BYTES was previously only enforced by the upload dialog's own
  // client-side check, so a direct POST to this route (bypassing the dialog)
  // could presign a URL with no size ceiling at all.
  contentLength: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES, `Файл завеликий (>${MAX_PHOTO_BYTES / (1024 * 1024)} МБ)`),
});

/** Same as presignRequestSchema, minus tournamentId - a news post's cover photo is presigned before the post row (and thus any id) exists. */
export const newsPhotoPresignRequestSchema = presignRequestSchema.omit({ tournamentId: true });

/** Same shape as newsPhotoPresignRequestSchema - a menu item's photo is presigned before the item row exists, same reasoning. */
export const menuPhotoPresignRequestSchema = presignRequestSchema.omit({ tournamentId: true });

export const confirmPhotoSchema = z
  .object({
    tournamentId: z.string().trim().min(1),
    key: z.string().trim().min(1),
    caption: z
      .union([z.literal(""), z.string().trim().max(200, "Максимум 200 символів")])
      .optional()
      .transform((value) => (value ? value : null)),
  })
  // Ties `key` back to the tournamentId it was actually presigned for (see
  // the `tournaments/${tournamentId}/...` shape /api/photos/presign builds)
  // - without this, confirmPhotoUploadAction would create a Photo row
  // pointing at any object key in the bucket, including one from a
  // different tournament's folder, since R2 keys aren't secret (they're
  // visible in every public photo URL).
  .refine((data) => data.key.startsWith(`tournaments/${data.tournamentId}/`), {
    message: "Ключ файлу не відповідає турніру",
    path: ["key"],
  });

/** Padel twin of confirmPhotoSchema - same shape, ties `key` back to the `padel-tournaments/${tournamentId}/...` prefix /api/padel-photos/presign builds instead. */
export const confirmPadelPhotoSchema = z
  .object({
    tournamentId: z.string().trim().min(1),
    key: z.string().trim().min(1),
    caption: z
      .union([z.literal(""), z.string().trim().max(200, "Максимум 200 символів")])
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((data) => data.key.startsWith(`padel-tournaments/${data.tournamentId}/`), {
    message: "Ключ файлу не відповідає турніру",
    path: ["key"],
  });
