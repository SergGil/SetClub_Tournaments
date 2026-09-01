import { NextResponse } from "next/server";

import { deleteTeamAction, updateTeamAction } from "@/lib/actions/teams";
import { withApiErrorHandling } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; teamId: string }> };

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, teamId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const memberPlayerIds = Array.isArray(body?.memberPlayerIds)
    ? body.memberPlayerIds.filter((v: unknown) => typeof v === "string")
    : [];

  const result = await updateTeamAction(id, teamId, name, memberPlayerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});

export const DELETE = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id, teamId } = await params;
  const result = await deleteTeamAction(id, teamId, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
});
