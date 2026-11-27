import { NextResponse } from "next/server";

import { commitSinglesGroupsAction } from "@/lib/actions/randomize-singles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ groupAssignment, matchups, acknowledgedCompletedLoss? }` - persists an exact draw previously returned by POST .../groups/draw. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const groupAssignment = body.groupAssignment ?? {};
  const matchups = unknownArray(body.matchups);
  const acknowledgedCompletedLoss = body.acknowledgedCompletedLoss === true;

  const result = await commitSinglesGroupsAction(id, checkedByAction(groupAssignment), checkedByAction(matchups), acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
