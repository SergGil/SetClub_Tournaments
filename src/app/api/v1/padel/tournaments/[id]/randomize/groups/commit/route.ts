import { NextResponse } from "next/server";

import { commitPadelSinglesGroupsAction } from "@/lib/actions/padel-randomize-singles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/groups/commit. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const groupAssignment = body?.groupAssignment ?? {};
  const matchups = Array.isArray(body?.matchups) ? body.matchups : [];
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;

  const result = await commitPadelSinglesGroupsAction(id, groupAssignment, matchups, acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
