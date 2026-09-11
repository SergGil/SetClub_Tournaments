import { NextResponse } from "next/server";

import { commitDoublesGroupsAction } from "@/lib/actions/randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ groupAssignment, matchups, acknowledgedCompletedLoss? }` - persists a draw previously returned by POST .../doubles/draw-groups. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const groupAssignment = body?.groupAssignment ?? {};
  const matchups = Array.isArray(body?.matchups) ? body.matchups : [];
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;
  // withPlayoff (see docs/DOUBLES_GROUP_PLAYOFF.md) isn't wired into the
  // mobile randomizer UI yet - always false here until that follow-up lands.
  const result = await commitDoublesGroupsAction(id, groupAssignment, matchups, acknowledgedCompletedLoss, false, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
