import { NextResponse } from "next/server";

import {
  getDoublesRatings,
  getDoublesRatingsTrend,
  getDoublesSetClubPoints,
  getDoublesSetClubTrend,
  getSetClubSeasons,
  getSinglesRatings,
  getSinglesRatingsTrend,
  getSinglesSetClubPoints,
  getSinglesSetClubTrend,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";
import type { SetClubSeason } from "@/lib/rating/ratings-data";
import { withApiErrorHandling } from "@/lib/api-auth";

function parseSeason(raw: string | null): SetClubSeason {
  if (!raw || raw === ROLLING_SEASON) return ROLLING_SEASON;
  const year = Number(raw);
  return Number.isInteger(year) ? year : ROLLING_SEASON;
}

/**
 * `?season=rolling|<year>` (default rolling-52-week) scopes the Set Club
 * points/trend; the Glicko-2/OpenSkill ratings themselves are always
 * all-time. See /rating and docs/RATING.md for what each field means.
 */
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
    getSinglesRatings(),
    getDoublesRatings(),
    getSinglesRatingsTrend(),
    getDoublesRatingsTrend(),
    getSetClubSeasons("SINGLES"),
    getSetClubSeasons("DOUBLES"),
    getSinglesSetClubPoints(season),
    getDoublesSetClubPoints(season),
    getSinglesSetClubTrend(season),
    getDoublesSetClubTrend(season),
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
