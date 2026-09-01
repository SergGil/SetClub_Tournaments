import { NextResponse } from "next/server";

import { deleteTieAction } from "@/lib/actions/ties";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; tieId: string }> };

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, tieId } = await params;
  const result = await deleteTieAction(id, tieId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
