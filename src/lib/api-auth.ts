import "server-only";

import { NextResponse } from "next/server";

/**
 * CDN cache headers for the heavy public reads (rating, leaderboard, achievements): Vercel serves
 * repeats of the same URL from the edge for a minute (and a stale copy while it refreshes), so a
 * burst of identical requests never reaches the database. Edits by admins therefore show up in
 * the JSON API up to ~a minute later - the web pages themselves are not cached by this.
 */
export const PUBLIC_API_CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } as const;

/**
 * Wraps a `src/app/api/v1/**` route handler so the `Forbidden`/`Unauthorized`
 * Errors thrown by src/lib/permissions.ts guards (requireDomainAdmin, etc. -
 * the same guards Server Actions use) map to proper HTTP status codes
 * instead of an unhandled 500, without repeating a try/catch in every route.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith("Unauthorized")) {
          return NextResponse.json({ error: error.message }, { status: 401 });
        }
        if (error.message.startsWith("Forbidden")) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
      }
      console.error("[api/v1] unhandled route error", error);
      return NextResponse.json({ error: "Внутрішня помилка сервера" }, { status: 500 });
    }
  };
}
