import { z } from "zod";

export const ALLOWED_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Generous ceiling for a phone photo - only guards against runaway uploads,
// not a quality/compression concern (see docs/PHOTOS.md).
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const presignRequestSchema = z.object({
  tournamentId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_PHOTO_CONTENT_TYPES),
});

export const confirmPhotoSchema = z.object({
  tournamentId: z.string().trim().min(1),
  key: z.string().trim().min(1),
  caption: z
    .union([z.literal(""), z.string().trim().max(200, "Максимум 200 символів")])
    .optional()
    .transform((value) => (value ? value : null)),
});
