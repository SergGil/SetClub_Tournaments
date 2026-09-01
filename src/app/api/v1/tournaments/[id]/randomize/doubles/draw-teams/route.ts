import { NextResponse } from "next/server";

import { drawDoublesTeamsAction } from "@/lib/actions/randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ fixedPairs? }` - read-only team-draw preview for the doubles randomizer's plain round robin. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fixedPairs = Array.isArray(body?.fixedPairs) ? body.fixedPairs : [];

  const result = await drawDoublesTeamsAction(id, fixedPairs, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
