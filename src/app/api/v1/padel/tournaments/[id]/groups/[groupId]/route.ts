import { NextResponse } from "next/server";

import {
  deletePadelTournamentGroupAction,
  updatePadelTournamentGroupAction,
  updatePadelTournamentGroupPairsAction,
} from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; groupId: string }> };

/** Padel twin of PATCH/DELETE /tournaments/[id]/groups/[groupId] - see that route. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, groupId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";

  if (Array.isArray(body?.pairs)) {
    const acknowledgedCompletedLoss = body?.acknowledgedCompletedLoss === true;
    const result = await updatePadelTournamentGroupPairsAction(id, groupId, name, body.pairs, acknowledgedCompletedLoss, request);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ matchCount: result.matchCount });
  }

  const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.filter((v: unknown) => typeof v === "string") : [];
  const result = await updatePadelTournamentGroupAction(id, groupId, name, playerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, groupId } = await params;
  const result = await deletePadelTournamentGroupAction(id, groupId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
