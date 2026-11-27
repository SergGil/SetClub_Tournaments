import { NextResponse } from "next/server";

import { commitDoublesMatchesAction } from "@/lib/actions/randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ matchups, acknowledgedCompletedLoss? }` - persists a draw previously returned by POST .../doubles/draw-teams. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const matchups = unknownArray(body.matchups);
  const acknowledgedCompletedLoss = body.acknowledgedCompletedLoss === true;

  const result = await commitDoublesMatchesAction(id, checkedByAction(matchups), acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
