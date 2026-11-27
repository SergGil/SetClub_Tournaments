import { NextResponse } from "next/server";

import { commitPadelDoublesGroupsAction } from "@/lib/actions/padel-randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/doubles/commit-groups. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const groupAssignment = body.groupAssignment ?? {};
  const matchups = unknownArray(body.matchups);
  const acknowledgedCompletedLoss = body.acknowledgedCompletedLoss === true;
  const withPlayoff = body.withPlayoff === true;
  const result = await commitPadelDoublesGroupsAction(
    id,
    checkedByAction(groupAssignment),
    checkedByAction(matchups),
    acknowledgedCompletedLoss,
    withPlayoff,
    request,
  );
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ matchCount: result.matchCount });
});
