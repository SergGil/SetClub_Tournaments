import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { displayName } from "@/lib/player-display";
import { getSeasonMatchCount } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { getSeasonTournamentCount } from "@/lib/queries/tournaments";
import { getDoublesSetClubPoints, getSinglesSetClubPoints } from "@/lib/rating/ratings-data";
import { buildSeasonShareData } from "@/lib/share/season-card-data";
import { seasonShareCardElement } from "@/lib/share/season-card-image";

export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Некоректний рік" }, { status: 400 });
  }

  const [matchesPlayed, tournamentsCompleted, singlesPoints, doublesPoints, players] = await Promise.all([
    getSeasonMatchCount(year),
    getSeasonTournamentCount(year),
    getSinglesSetClubPoints(year),
    getDoublesSetClubPoints(year),
    getPlayers(),
  ]);
  const nameById = new Map(players.map((p) => [p.id, displayName(p)]));

  const data = buildSeasonShareData(year, matchesPlayed, tournamentsCompleted, singlesPoints, doublesPoints, nameById);
  if (!data) {
    return NextResponse.json({ error: "За цей рік ще немає завершених матчів" }, { status: 404 });
  }

  return new ImageResponse(seasonShareCardElement(data), { width: 1200, height: 630 });
}
