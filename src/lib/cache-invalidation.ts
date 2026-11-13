import { revalidateTag } from "next/cache";

/**
 * Expires a cache tag immediately - the next read waits for fresh data, and a
 * Server Action's own re-render sees its writes - for code that runs in BOTH
 * Server Actions and Route Handlers: every `*-core.ts` in src/lib/actions is
 * shared by a Server Action and an /api/v1 route (docs/MOBILE_API.md).
 *
 * `updateTag` can't be used there: Next throws "updateTag can only be called
 * from within a Server Action" when the current page is a route, which used
 * to happen AFTER the core's transaction had committed - the mobile app got a
 * 500 for a write that had in fact been saved, the stats/rating cache stayed
 * stale for up to its 60 s revalidate, and the rating-snapshot refresh
 * scheduled after it never ran. `revalidateTag(tag, { expire: 0 })` is the
 * documented Route Handler equivalent and goes through the same internal
 * path as updateTag (immediate expiry, read-your-own-writes), so Server
 * Actions behave exactly as before. Plain Server-Action-only files can keep
 * calling updateTag directly.
 */
export function expireCacheTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}
