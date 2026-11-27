import { NextResponse } from "next/server";

import { drawPadelDoublesGroupsAction } from "@/lib/actions/padel-randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/doubles/draw-groups. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const fixedPairs = unknownArray(body.fixedPairs);
  const groupCount = typeof body.groupCount === "number" ? body.groupCount : undefined;
  const withPlayoff = body.withPlayoff === true;
  const result = await drawPadelDoublesGroupsAction(id, checkedByAction(fixedPairs), groupCount, withPlayoff, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
