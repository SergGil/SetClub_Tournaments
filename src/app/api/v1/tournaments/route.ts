import { NextResponse } from "next/server";

import { createTournamentCore } from "@/lib/actions/tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getTournamentsPage } from "@/lib/queries/tournaments";
import type { TournamentSortKey } from "@/lib/queries/tournaments";
import { tournamentFormSchema } from "@/lib/validation/tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

const SORT_KEYS: TournamentSortKey[] = ["startDate", "participants", "matches"];

export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const format = searchParams.get("format") as "SINGLES" | "DOUBLES" | "MIXED" | null;
  const sortKey = searchParams.get("sortKey");
  const sortDir = searchParams.get("sortDir");
  const sort =
    sortKey && SORT_KEYS.includes(sortKey as TournamentSortKey)
      ? { key: sortKey as TournamentSortKey, dir: sortDir === "asc" ? ("asc" as const) : ("desc" as const) }
      : undefined;

  const { tournaments, total } = await getTournamentsPage(limit, query, sort, format ?? undefined);
  return NextResponse.json({ tournaments, total });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("TENNIS", request);

  const body = await request.json().catch(() => null);
  const parsed = tournamentFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const tournament = await createTournamentCore(session, parsed.data);
  return NextResponse.json({ tournament }, { status: 201 });
});
