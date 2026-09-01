import { NextResponse } from "next/server";

import { addPadelParticipantAction } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.filter((v: unknown) => typeof v === "string") : [];

  const result = await addPadelParticipantAction(id, playerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
