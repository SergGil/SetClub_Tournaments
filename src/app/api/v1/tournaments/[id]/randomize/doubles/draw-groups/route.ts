import { NextResponse } from "next/server";

import { drawDoublesGroupsAction } from "@/lib/actions/randomize-doubles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ fixedPairs?, groupCount? }` - read-only draw preview for the doubles "За групами" strategy. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fixedPairs = Array.isArray(body?.fixedPairs) ? body.fixedPairs : [];
  const groupCount = typeof body?.groupCount === "number" ? body.groupCount : undefined;

  const result = await drawDoublesGroupsAction(id, fixedPairs, groupCount, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
