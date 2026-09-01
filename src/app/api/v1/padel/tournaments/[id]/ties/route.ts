import { NextResponse } from "next/server";

import { createPadelTieAction } from "@/lib/actions/padel-ties";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPadelTeamTieStandings } from "@/lib/padel-tournament-ties";

type Params = { params: Promise<{ id: string }> };

/** Padel twin of GET /api/v1/tournaments/[id]/ties. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const standings = await getPadelTeamTieStandings(id);
  return NextResponse.json(standings);
});

export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const teamAId = typeof body?.teamAId === "string" ? body.teamAId : "";
  const teamBId = typeof body?.teamBId === "string" ? body.teamBId : "";
  const label = typeof body?.label === "string" ? body.label : "";

  const result = await createPadelTieAction(id, teamAId, teamBId, label, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
