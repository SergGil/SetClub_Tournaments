import { NextResponse } from "next/server";

import { drawPadelDoublesTeamsAction } from "@/lib/actions/padel-randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, unknownArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/doubles/draw-teams. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const fixedPairs = unknownArray(body.fixedPairs);

  const result = await drawPadelDoublesTeamsAction(id, checkedByAction(fixedPairs), request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
