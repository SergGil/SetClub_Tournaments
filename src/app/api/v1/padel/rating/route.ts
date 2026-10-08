import { NextResponse } from "next/server";

import { PUBLIC_API_CACHE, withApiErrorHandling } from "@/lib/api-auth";
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
import { PUBLIC_READ_LIMIT, withRateLimit } from "@/lib/rate-limit";

function parseSeason(raw: string | null): PadelSetClubSeason {
  if (!raw || raw === PADEL_ROLLING_SEASON) return PADEL_ROLLING_SEASON;
  const year = Number(raw);
  return Number.isInteger(year) ? year : PADEL_ROLLING_SEASON;
}

/** Padel twin of GET /api/v1/rating. */
export const GET = withApiErrorHandling(withRateLimit(PUBLIC_READ_LIMIT, async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const season = parseSeason(searchParams.get("season"));
  // `?pool=women` returns the women's rating pool (women-only tournaments, docs/RATING.md);
  // anything else - including no param - is the general pool, as before.
  const scope = searchParams.get("pool") === "women" ? "women" : "general";

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
    getPadelSinglesRatings(scope),
    getPadelDoublesRatings(scope),
    getPadelSinglesRatingsTrend(scope),
    getPadelDoublesRatingsTrend(scope),
    getPadelSetClubSeasons("SINGLES", scope),
    getPadelSetClubSeasons("DOUBLES", scope),
    getPadelSinglesSetClubPoints(season, scope),
    getPadelDoublesSetClubPoints(season, scope),
    getPadelSinglesSetClubTrend(season, scope),
    getPadelDoublesSetClubTrend(season, scope),
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
  }, { headers: PUBLIC_API_CACHE });
}));
