import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import {
  getPadelDoublesRatings,
  getPadelDoublesRatingsTrend,
  getPadelDoublesSetClubPoints,
  getPadelDoublesSetClubTrend,
  getPadelSetClubSeasons,
  getPadelSinglesRatings,
  getPadelSinglesRatingsTrend,
  getPadelSinglesSetClubPoints,
  getPadelSinglesSetClubTrend,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";
import type { PadelSetClubSeason } from "@/lib/rating/padel-ratings-data";

function parseSeason(raw: string | null): PadelSetClubSeason {
  if (!raw || raw === PADEL_ROLLING_SEASON) return PADEL_ROLLING_SEASON;
  const year = Number(raw);
  return Number.isInteger(year) ? year : PADEL_ROLLING_SEASON;
}

/** Padel twin of GET /api/v1/rating. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const season = parseSeason(searchParams.get("season"));

  const [
    singlesRatings,
    doublesRatings,
    singlesTrend,
    doublesTrend,
    singlesSeasons,
    doublesSeasons,
    singlesPoints,
    doublesPoints,
    singlesPointsTrend,
    doublesPointsTrend,
  ] = await Promise.all([
    getPadelSinglesRatings(),
    getPadelDoublesRatings(),
    getPadelSinglesRatingsTrend(),
    getPadelDoublesRatingsTrend(),
    getPadelSetClubSeasons("SINGLES"),
    getPadelSetClubSeasons("DOUBLES"),
    getPadelSinglesSetClubPoints(season),
    getPadelDoublesSetClubPoints(season),
    getPadelSinglesSetClubTrend(season),
    getPadelDoublesSetClubTrend(season),
  ]);

  return NextResponse.json({
    season,
    singles: {
      ratings: singlesRatings,
      trend: Object.fromEntries(singlesTrend),
      setClubSeasons: singlesSeasons,
      setClubPoints: singlesPoints,
      setClubPointsTrend: Object.fromEntries(singlesPointsTrend),
    },
    doubles: {
      ratings: doublesRatings,
      trend: Object.fromEntries(doublesTrend),
      setClubSeasons: doublesSeasons,
      setClubPoints: doublesPoints,
      setClubPointsTrend: Object.fromEntries(doublesPointsTrend),
    },
  });
});
