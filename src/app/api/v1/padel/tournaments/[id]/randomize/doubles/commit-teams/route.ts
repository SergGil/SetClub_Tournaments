import { NextResponse } from "next/server";

import { commitPadelDoublesMatchesAction } from "@/lib/actions/padel-randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/doubles/commit-teams. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const matchups = unknownArray(body.matchups);
  const acknowledgedCompletedLoss = body.acknowledgedCompletedLoss === true;

  const result = await commitPadelDoublesMatchesAction(id, checkedByAction(matchups), acknowledgedCompletedLoss, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
