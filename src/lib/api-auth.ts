import "server-only";

import { NextResponse } from "next/server";

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
