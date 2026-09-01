import { NextResponse } from "next/server";

import { withdrawParticipantCore } from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; playerId: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const session = await requireDomainAdmin("TENNIS", request);

  const body = await request.json().catch(() => ({}));
  const acknowledgedCascadeReset = body?.acknowledgedCascadeReset === true;

  const result = await withdrawParticipantCore(session, id, playerId, acknowledgedCascadeReset);
  if (result.error) {
    return NextResponse.json({ error: result.error, cascadeResets: result.cascadeResets }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});
