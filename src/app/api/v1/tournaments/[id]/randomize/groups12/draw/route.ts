import { NextResponse } from "next/server";

import { drawGroups12PlayoffAction } from "@/lib/actions/randomize-singles-groups12";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Read-only draw preview for GROUPS_12_PLAYOFF (requires exactly 12 participants, 4 seeded) - see docs/GROUPS12_PLAYOFF.md. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const result = await drawGroups12PlayoffAction(id, request);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
});
