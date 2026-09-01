import { NextResponse } from "next/server";

import { removePadelParticipantAction, setPadelParticipantGroupAction, togglePadelParticipantSeedAction } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; playerId: string }> };

/** Padel twin of PATCH/DELETE /tournaments/[id]/participants/[playerId] - see that route. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const body = await request.json().catch(() => ({}));

  if (typeof body?.seeded === "boolean") {
    await togglePadelParticipantSeedAction(id, playerId, body.seeded, request);
  }
  if ("group" in (body ?? {})) {
    const group = body.group;
    if (group !== null && typeof group !== "number") {
      return NextResponse.json({ error: "Некоректний номер групи" }, { status: 400 });
    }
    const result = await setPadelParticipantGroupAction(id, playerId, group, request);
    if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const result = await removePadelParticipantAction(id, playerId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
