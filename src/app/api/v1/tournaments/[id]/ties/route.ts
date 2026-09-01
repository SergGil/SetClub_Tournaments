import { NextResponse } from "next/server";

import { createTieAction } from "@/lib/actions/ties";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getTeamTieStandings } from "@/lib/tournament-ties";

type Params = { params: Promise<{ id: string }> };

/** Every tie (with teamA/teamB rosters and their rubbers) plus the ranked team standings derived from them - src/lib/tournament-ties.ts. Empty for a tournament that never created a team. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const standings = await getTeamTieStandings(id);
  return NextResponse.json(standings);
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teamAId = typeof body?.teamAId === "string" ? body.teamAId : "";
  const teamBId = typeof body?.teamBId === "string" ? body.teamBId : "";
  const label = typeof body?.label === "string" ? body.label : "";

  const result = await createTieAction(id, teamAId, teamBId, label, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
