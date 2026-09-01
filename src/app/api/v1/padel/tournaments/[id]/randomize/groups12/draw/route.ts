import { NextResponse } from "next/server";

import { drawPadelGroups12PlayoffAction } from "@/lib/actions/padel-randomize-singles-groups12";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /api/v1/tournaments/[id]/randomize/groups12/draw. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const result = await drawPadelGroups12PlayoffAction(id, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
