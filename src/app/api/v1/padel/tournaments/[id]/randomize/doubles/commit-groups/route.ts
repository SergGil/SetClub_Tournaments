import { NextResponse } from "next/server";

import { commitPadelDoublesGroupsAction } from "@/lib/actions/padel-randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/doubles/commit-groups. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const groupAssignment = body?.groupAssignment ?? {};
  const matchups = Array.isArray(body?.matchups) ? body.matchups : [];
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;
  // withPlayoff (see docs/DOUBLES_GROUP_PLAYOFF.md) isn't wired into the
  // mobile randomizer UI yet - always false here until that follow-up lands.
  const result = await commitPadelDoublesGroupsAction(
    id,
    groupAssignment,
    matchups,
    acknowledgedCompletedLoss,
    false,
    request,
  );
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
