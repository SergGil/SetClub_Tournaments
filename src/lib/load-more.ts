/**
 * Parses a "load more" list's `?show=` search param into how many items to
 * fetch. Never less than `pageSize` (a stale/tampered/missing value just
 * falls back to the first page) - `show` only ever grows via the Load More
 * link, so anything smaller is either absent or not worth honoring.
 */
export function parseShowParam(showParam: string | undefined, pageSize: number): number {
  const parsed = Math.trunc(Number(showParam));
  return Number.isFinite(parsed) && parsed > pageSize ? parsed : pageSize;
}
