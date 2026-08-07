/**
 * Every "load more" click only ever grows `show` by one `pageSize` at a
 * time, so a legitimate value never needs to exceed a few clicks' worth -
 * this just bounds how large a `take` a tampered `?show=` can force onto
 * the underlying query.
 */
const MAX_SHOW_MULTIPLE = 100;

/**
 * Parses a "load more" list's `?show=` search param into how many items to
 * fetch. Never less than `pageSize` (a stale/tampered/missing value just
 * falls back to the first page) - `show` only ever grows via the Load More
 * link, so anything smaller is either absent or not worth honoring. Capped
 * at `pageSize * MAX_SHOW_MULTIPLE` so a tampered `?show=` can't force an
 * unbounded `take` onto the query.
 */
export function parseShowParam(showParam: string | undefined, pageSize: number): number {
  const parsed = Math.trunc(Number(showParam));
  if (!Number.isFinite(parsed) || parsed <= pageSize) return pageSize;
  return Math.min(parsed, pageSize * MAX_SHOW_MULTIPLE);
}
