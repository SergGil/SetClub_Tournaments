import { NextResponse } from "next/server";

import { deletePadelTieAction } from "@/lib/actions/padel-ties";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; tieId: string }> };

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, tieId } = await params;
  const result = await deletePadelTieAction(id, tieId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
