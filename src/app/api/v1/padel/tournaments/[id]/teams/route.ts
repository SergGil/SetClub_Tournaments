import { NextResponse } from "next/server";

import { createPadelTeamAction } from "@/lib/actions/padel-teams";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPadelTournamentTeams } from "@/lib/queries/padel-tournament-teams";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of GET /api/v1/tournaments/[id]/teams. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const teams = await getPadelTournamentTeams(id);
  return NextResponse.json({ teams });
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const memberPlayerIds = Array.isArray(body?.memberPlayerIds)
    ? body.memberPlayerIds.filter((v: unknown) => typeof v === "string")
    : [];

  const result = await createPadelTeamAction(id, name, memberPlayerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
