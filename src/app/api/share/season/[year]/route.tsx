import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getPadelSeasonMatchCount } from "@/lib/queries/padel-matches";
import { getPadelSeasonTournamentCount } from "@/lib/queries/padel-tournaments";
import { displayName } from "@/lib/player-display";
import { getSeasonMatchCount } from "@/lib/queries/matches";
import { getPlayers } from "@/lib/queries/players";
import { getSeasonTournamentCount } from "@/lib/queries/tournaments";
import { mergeSetClubPoints } from "@/lib/rating/placement";
import { getPadelDoublesSetClubPoints, getPadelSinglesSetClubPoints } from "@/lib/rating/padel-ratings-data";
import { getDoublesSetClubPoints, getSinglesSetClubPoints } from "@/lib/rating/ratings-data";
import { buildSeasonShareData } from "@/lib/share/season-card-data";
import { seasonShareCardElement } from "@/lib/share/season-card-image";

/**
 * "Рік у SET.club" is a whole-club recap, not a Tennis-only one (see
 * docs/SHARE_CARDS.md) - Tennis and Padel are separate tournament engines
 * (docs/PADEL.md) sharing one Player roster, so every count/leader here
 * is Tennis + Padel combined rather than either sport read alone.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Некоректний рік" }, { status: 400 });
  }

  const [
    tennisMatches,
    padelMatches,
    tennisTournaments,
    padelTournaments,
    tennisSingles,
    padelSingles,
    tennisDoubles,
    padelDoubles,
    players,
  ] = await Promise.all([
    getSeasonMatchCount(year),
    getPadelSeasonMatchCount(year),
    getSeasonTournamentCount(year),
    getPadelSeasonTournamentCount(year),
    getSinglesSetClubPoints(year),
    getPadelSinglesSetClubPoints(year),
    getDoublesSetClubPoints(year),
    getPadelDoublesSetClubPoints(year),
    getPlayers(),
  ]);
  const nameById = new Map(players.map((p) => [p.id, displayName(p)]));

  const data = buildSeasonShareData(
    year,
    tennisMatches + padelMatches,
    tennisTournaments + padelTournaments,
    mergeSetClubPoints(tennisSingles, padelSingles),
    mergeSetClubPoints(tennisDoubles, padelDoubles),
    nameById,
  );
  if (!data) {
    return NextResponse.json({ error: "За цей рік ще немає завершених матчів" }, { status: 404 });
  }

  return new ImageResponse(seasonShareCardElement(data), { width: 1200, height: 630 });
}
