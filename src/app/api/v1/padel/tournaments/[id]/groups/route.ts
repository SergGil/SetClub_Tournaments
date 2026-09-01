import { NextResponse } from "next/server";

import { createPadelTournamentGroupAction, createPadelTournamentGroupWithPairsAction } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of POST /tournaments/[id]/groups - see that route for the body dispatch rules. */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  if (Array.isArray(body?.pairs)) {
    const result = await createPadelTournamentGroupWithPairsAction(id, name, body.pairs, request);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ matchCount: result.matchCount }, { status: 201 });
  }

  const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.filter((v: unknown) => typeof v === "string") : [];
  const result = await createPadelTournamentGroupAction(id, name, playerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
