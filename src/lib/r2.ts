import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const globalForR2 = globalThis as unknown as {
  r2Client?: S3Client;
};

// Built lazily (on first real use), not at module scope like src/lib/db.ts's
// PrismaClient: DATABASE_URL is a hard app-wide dependency so failing fast at
// import time is fine there, but R2_* is feature-scoped - most pages never
// touch it, and Next's build-time page-data collection evaluates every route
// module's imports regardless of whether that route runs. Eagerly reading
// R2_ACCOUNT_ID etc. here would break `next build` for the whole app until
// the R2 bucket/credentials exist, not just the photo upload feature.
function getR2Client(): S3Client {
  if (globalForR2.r2Client) return globalForR2.r2Client;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  if (process.env.NODE_ENV !== "production") {
    globalForR2.r2Client = client;
  }
  return client;
}

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 5 * 60;

/**
 * `contentType`/`contentLength` are both signed into the URL (part of the
 * request that gets authenticated, not just advisory metadata) - the actual
 * PUT must match both exactly, or R2 rejects it. This is what actually
 * enforces ALLOWED_PHOTO_CONTENT_TYPES/MAX_PHOTO_BYTES server-side: without
 * pinning them here, those were only checked by the browser's own upload
 * dialog before it *asked* for a URL, which a direct POST to
 * /api/photos/presign could bypass entirely.
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env("R2_BUCKET_NAME"),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS });
}

/** Best-effort: callers should catch failures rather than let a storage hiccup block a DB mutation. */
export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET_NAME"), Key: key }));
}

export function publicPhotoUrl(key: string): string {
  return `${env("R2_PUBLIC_URL")}/${key}`;
}

/**
 * Strips any directory portion and non-portable characters, keeping the R2
 * key predictable regardless of what the browser sent as the original file
 * name. `||`, not `??` - `.pop()` on a string split always returns a string,
 * never `undefined` (even splitting "" yields [""]), so a degenerate input
 * (empty, or a path ending in a separator) needs the empty-string fallback
 * `||` actually catches, not the `undefined`-only one `??` was dead-code
 * guarding against.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "photo";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}
