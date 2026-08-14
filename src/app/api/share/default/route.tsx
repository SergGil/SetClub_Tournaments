import { ImageResponse } from "next/og";

import { defaultShareCardElement } from "@/lib/share/default-card-image";

// Purely static output (no DB read, no request data) - cache it instead of
// re-rendering on every crawler/messenger fetch, same reasoning as any other
// GET Route Handler that doesn't need per-request freshness (see
// node_modules/next/dist/docs/.../15-route-handlers.md's "Route Handlers
// are not cached by default" note).
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(defaultShareCardElement(), { width: 1200, height: 630 });
}
