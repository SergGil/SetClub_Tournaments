import { NextResponse } from "next/server";

import { drawSinglesGroupsAction } from "@/lib/actions/randomize-singles";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Read-only draw preview for the CUSTOM_GROUPS singles strategy - commit the exact result via POST .../groups/commit. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const result = await drawSinglesGroupsAction(id, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
