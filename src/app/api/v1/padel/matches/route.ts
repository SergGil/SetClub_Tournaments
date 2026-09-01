import { NextResponse } from "next/server";

import { createPadelMatchCore } from "@/lib/actions/padel-matches";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getPadelTournamentMatches, getPlayerPadelMatches, getRecentCompletedPadelMatches } from "@/lib/queries/padel-matches";
import { matchFormSchema } from "@/lib/validation/match";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

/** Padel twin of GET /api/v1/matches - see that route for the query-param dispatch rules. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get("tournamentId");
  const playerId = searchParams.get("playerId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);

  const matches = tournamentId
    ? await getPadelTournamentMatches(tournamentId)
    : playerId
      ? await getPlayerPadelMatches(playerId)
      : await getRecentCompletedPadelMatches(limit);

  return NextResponse.json({ matches });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("PADEL", request);

  const body = await request.json().catch(() => null);
  const parsed = matchFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createPadelMatchCore(session, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
});
