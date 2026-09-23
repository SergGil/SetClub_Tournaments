import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import { requireUser } from "@/lib/permissions";
import { getPlayerByUserId } from "@/lib/queries/players";

/**
 * The signed-in user's own linked Player (auto-linked by email on sign-in -
 * see src/lib/auth-provisioning.ts), or `{ player: null }` if this account
 * has no Player row yet. Web's nav already resolves this server-side
 * (IdentityLink in src/components/nav.tsx) to link the header avatar to
 * `/players/[id]`; this route is the mobile client's equivalent for the same
 * "go to my own profile" entry point. A literal `/me` segment takes priority
 * over the `[id]` dynamic route right above it - standard Next.js routing,
 * not a special case here.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const session = await requireUser(request);
  const player = await getPlayerByUserId(session.user.id);
  return NextResponse.json({ player });
});
