import { NextResponse } from "next/server";

import { resetPadelTournamentCore } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const session = await requireDomainAdmin("PADEL", request);

  const body = await request.json().catch(() => ({}));
  const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;

  const result = await resetPadelTournamentCore(session, id, acknowledgedCompletedLoss);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
