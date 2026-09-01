import { NextResponse } from "next/server";

import { createTeamAction } from "@/lib/actions/teams";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getTournamentTeams } from "@/lib/queries/tournament-teams";

type Params = { params: Promise<{ id: string }> };

/** MIXED-format teams only - empty array for a tournament that never opted into team/tie play (docs/TOURNAMENT_TEAMS.md). */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const teams = await getTournamentTeams(id);
  return NextResponse.json({ teams });
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const memberPlayerIds = Array.isArray(body?.memberPlayerIds)
    ? body.memberPlayerIds.filter((v: unknown) => typeof v === "string")
    : [];

  const result = await createTeamAction(id, name, memberPlayerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
