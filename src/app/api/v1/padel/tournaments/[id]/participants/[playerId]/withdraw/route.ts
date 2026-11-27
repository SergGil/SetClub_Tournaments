import { NextResponse } from "next/server";

import { withdrawPadelParticipantCore } from "@/lib/actions/padel-tournaments-core";
import { withApiErrorHandling } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/api-body";
import { requireDomainAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; playerId: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const body = await readJsonBody(request);
  const acknowledgedCascadeReset = body.acknowledgedCascadeReset === true;

  const result = await withdrawPadelParticipantCore(session, id, playerId, acknowledgedCascadeReset);
  if (result.error) {
    return NextResponse.json({ error: result.error, cascadeResets: result.cascadeResets }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});
