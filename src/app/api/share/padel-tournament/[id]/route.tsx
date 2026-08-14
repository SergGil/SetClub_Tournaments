import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";
import { getPadelTournamentById } from "@/lib/queries/padel-tournaments";
import { buildTournamentShareData } from "@/lib/share/tournament-card-data";
import { tournamentShareCardElement } from "@/lib/share/tournament-card-image";

/**
 * Padel twin of api/share/tournament/[id]/route.tsx - only the queries
 * differ. buildTournamentShareData/tournamentShareCardElement are pure
 * functions over plain data (no Prisma coupling) and are reused unchanged:
 * padel-tournament-standings.ts's TournamentStandingsResult is structurally
 * identical to Tennis's.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getPadelTournamentById(id);
  if (!tournament) {
    return NextResponse.json({ error: "Турнір не знайдено" }, { status: 404 });
  }

  const standings = await getPadelTournamentStandingsRows(id, tournament.format, tournament.participants);
  const data = buildTournamentShareData(tournament.name, tournament.participants.length, standings);
  if (!data) {
    return NextResponse.json({ error: "Підсумкові місця турніру ще не вирішено" }, { status: 404 });
  }

  return new ImageResponse(tournamentShareCardElement(data), { width: 1200, height: 630 });
}
