/**
 * Best-effort, per-IP fixed-window rate limit for the public JSON API (src/app/api/v1/**).
 *
 * State lives in the memory of one serverless instance, so this is NOT a global quota: a burst
 * spread over many cold instances gets through, and an instance restart resets the counters. It
 * still stops the realistic abuse - one client hammering a heavy endpoint (rating, leaderboard:
 * full-history replays) in a tight loop - without a new database table or an external store.
 * Repeated identical requests are also absorbed by the CDN via PUBLIC_API_CACHE before they ever
 * reach a function. If traffic ever needs a hard guarantee, swap the Map for a shared store
 * (Upstash/Redis) behind the same checkRateLimit() signature.
 */

export type RateLimitOptions = {
  /** Max requests per client per window. */
  limit: number;
  windowMs: number;
  /** Separate counters per endpoint group, so hammering one route doesn't lock the client out of another. */
  name: string;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
// Hard cap so a flood of distinct spoofed IPs can't grow the map without bound.
const MAX_BUCKETS = 5_000;

/** Vercel sets x-forwarded-for itself (its first entry is the real client), so it can't be spoofed through the edge. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function evict(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still over the cap (everything live): drop the oldest entries first (Map keeps insertion order).
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

export function checkRateLimit(
  request: Request,
  { limit, windowMs, name }: RateLimitOptions,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = `${name}:${clientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) evict(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Wraps a route handler: over-limit clients get 429 + Retry-After instead of running the handler. */
export function withRateLimit<Args extends [Request, ...unknown[]]>(
  options: RateLimitOptions,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const result = checkRateLimit(args[0], options);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: "Забагато запитів. Спробуйте за хвилину." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(result.retryAfterSeconds) },
      });
    }
    return handler(...args);
  };
}

/** Heavy public reads (rating/leaderboard replays): generous for the app, tight for a script. */
export const PUBLIC_READ_LIMIT: RateLimitOptions = { name: "public-read", limit: 60, windowMs: 60_000 };

/** Mobile Google sign-in verifies a token and writes rows - far fewer legitimate calls than reads. */
export const SIGN_IN_LIMIT: RateLimitOptions = { name: "sign-in", limit: 10, windowMs: 60_000 };

/** Test-only: forget all counters. */
export function resetRateLimits() {
  buckets.clear();
}
