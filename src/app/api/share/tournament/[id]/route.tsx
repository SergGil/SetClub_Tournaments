import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getTournamentById } from "@/lib/queries/tournaments";
import { buildTournamentShareData } from "@/lib/share/tournament-card-data";
import { tournamentShareCardElement } from "@/lib/share/tournament-card-image";
import { getTournamentStandingsRows } from "@/lib/tournament-standings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) {
    return NextResponse.json({ error: "Турнір не знайдено" }, { status: 404 });
  }

  const standings = await getTournamentStandingsRows(id, tournament.format, tournament.participants);
  const data = buildTournamentShareData(tournament.name, tournament.participants.length, standings);
  if (!data) {
    return NextResponse.json({ error: "Підсумкові місця турніру ще не вирішено" }, { status: 404 });
  }

  return new ImageResponse(tournamentShareCardElement(data), { width: 1200, height: 630 });
}
