import { NextResponse } from "next/server";

import { commitGroups12PlayoffAction } from "@/lib/actions/randomize-singles-groups12";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const groupAssignment = body.groupAssignment ?? {};
  const matchups = unknownArray(body.matchups);
  const acknowledgedCompletedLoss = body.acknowledgedCompletedLoss === true;

  const result = await commitGroups12PlayoffAction(id, checkedByAction(groupAssignment), checkedByAction(matchups), acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
