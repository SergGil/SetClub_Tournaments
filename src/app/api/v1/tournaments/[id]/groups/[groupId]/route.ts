import { NextResponse } from "next/server";

import {
  deleteTournamentGroupAction,
  updateTournamentGroupAction,
  updateTournamentGroupPairsAction,
} from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; groupId: string }> };

/** Same `playerIds` vs `pairs` body dispatch as POST /tournaments/[id]/groups - see that route. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, groupId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  if (Array.isArray(body?.pairs)) {
    const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;
    const result = await updateTournamentGroupPairsAction(id, groupId, name, body.pairs, acknowledgedCompletedLoss, request);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ matchCount: result.matchCount });
  }

  const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.filter((v: unknown) => typeof v === "string") : [];
  const result = await updateTournamentGroupAction(id, groupId, name, playerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, groupId } = await params;
  const result = await deleteTournamentGroupAction(id, groupId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
