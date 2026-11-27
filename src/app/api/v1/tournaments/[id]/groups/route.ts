import { NextResponse } from "next/server";

import { createTournamentGroupAction, createTournamentGroupWithPairsAction } from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { checkedByAction, readJsonBody, stringArray } from "@/lib/api-body";

type Params = { params: Promise<{ id: string }> };

/**
 * Body: `{ name, playerIds }` for a loose group (createTournamentGroupAction), or
 * `{ name, pairs: [string, string][] }` for a doubles group with its full round robin
 * pre-generated (createTournamentGroupWithPairsAction) - mirrors the two admin-UI dialogs.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readJsonBody(request);
  const name = typeof body.name === "string" ? body.name : "";

  if (Array.isArray(body.pairs)) {
    const result = await createTournamentGroupWithPairsAction(id, name, checkedByAction(body.pairs), request);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ matchCount: result.matchCount }, { status: 201 });
  }

  const playerIds = stringArray(body.playerIds);
  const result = await createTournamentGroupAction(id, name, playerIds, request);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
