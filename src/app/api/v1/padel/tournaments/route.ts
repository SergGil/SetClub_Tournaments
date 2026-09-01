import { NextResponse } from "next/server";

import { createPadelTournamentCore } from "@/lib/actions/padel-tournaments";
import { withApiErrorHandling } from "@/lib/api-auth";
import { requireDomainAdmin } from "@/lib/permissions";
import { getPadelTournamentsPage } from "@/lib/queries/padel-tournaments";
import type { PadelTournamentSortKey } from "@/lib/queries/padel-tournaments";
import { padelTournamentFormSchema } from "@/lib/validation/padel-tournament";
import { fieldErrorsFromZod } from "@/lib/zod-errors";

const SORT_KEYS: PadelTournamentSortKey[] = ["startDate", "participants", "matches"];

export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 100);
  const query = searchParams.get("q") ?? undefined;
  const format = searchParams.get("format") as "SINGLES" | "DOUBLES" | "MIXED" | null;
  const sortKey = searchParams.get("sortKey");
  const sortDir = searchParams.get("sortDir");
  const sort =
    sortKey && SORT_KEYS.includes(sortKey as PadelTournamentSortKey)
      ? { key: sortKey as PadelTournamentSortKey, dir: sortDir === "asc" ? ("asc" as const) : ("desc" as const) }
      : undefined;

  const { tournaments, total } = await getPadelTournamentsPage(limit, query, sort, format ?? undefined);
  return NextResponse.json({ tournaments, total });
});

export const POST = withApiErrorHandling(async (request: Request) => {
  const session = await requireDomainAdmin("PADEL", request);

  const body = await request.json().catch(() => null);
  const parsed = padelTournamentFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некоректні дані", fieldErrors: fieldErrorsFromZod(parsed.error) },
      { status: 400 },
    );
  }

  const tournament = await createPadelTournamentCore(session, parsed.data);
  return NextResponse.json({ tournament }, { status: 201 });
});
