import { NextResponse } from "next/server";

import { removeParticipantAction, setParticipantGroupAction, toggleParticipantSeedAction } from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; playerId: string }> };

/** Body: `{ seeded?: boolean, group?: number | null }` - mirrors the two separate client actions the admin UI already exposes (toggle seed, set round-robin group). */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const body = await request.json().catch(() => ({}));

  if (typeof body?.seeded === "boolean") {
    await toggleParticipantSeedAction(id, playerId, body.seeded, request);
  }
  if ("group" in (body ?? {})) {
    const group = body.group;
    if (group !== null && typeof group !== "number") {
      return NextResponse.json({ error: "Некоректний номер групи" }, { status: 400 });
    }
    const result = await setParticipantGroupAction(id, playerId, group, request);
    if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, playerId } = await params;
  const result = await removeParticipantAction(id, playerId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
