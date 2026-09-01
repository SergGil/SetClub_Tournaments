import { NextResponse } from "next/server";

import { createMatchCore } from "@/lib/actions/matches";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getPlayerMatches, getRecentCompletedMatches, getTournamentMatches } from "@/lib/queries/matches";
import { matchFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

/** `?tournamentId=` or `?playerId=` scopes the list; otherwise the `limit` most recently played matches club-wide. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get("tournamentId");
  const playerId = searchParams.get("playerId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);

  const matches = tournamentId
    ? await getTournamentMatches(tournamentId)
    : playerId
      ? await getPlayerMatches(playerId)
      : await getRecentCompletedMatches(limit);

  return NextResponse.json({ matches });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("TENNIS", request);

  const body = await request.json().catch(() => null);
  const parsed = matchFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createMatchCore(session, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
