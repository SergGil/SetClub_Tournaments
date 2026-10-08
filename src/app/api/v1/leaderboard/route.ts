import { NextResponse } from "next/server";

import type { MatchType } from "@/generated/prisma/enums";
import { PUBLIC_API_CACHE, withApiErrorHandling } from "@/lib/api-auth";
import {
  getAllPlayerStats,
  getHeadToHeadMatchRows,
  getMonthlyActivity,
  getResultYears,
} from "@/lib/stats";
import { PUBLIC_READ_LIMIT, withRateLimit } from "@/lib/rate-limit";

/** `?type=SINGLES|DOUBLES` (default both), `?year=<calendar year>` (default all-time). */
export const GET = withApiErrorHandling(withRateLimit(PUBLIC_READ_LIMIT, async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const matchType = typeParam === "SINGLES" || typeParam === "DOUBLES" ? (typeParam as MatchType) : undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  const [stats, headToHead, monthlyActivity, years] = await Promise.all([
    getAllPlayerStats(matchType, year),
    getHeadToHeadMatchRows(matchType, year),
    getMonthlyActivity(),
    getResultYears(),
  ]);

  return NextResponse.json({
    stats: Object.fromEntries(stats),
    headToHead,
    monthlyActivity,
    years,
  }, { headers: PUBLIC_API_CACHE });
}));
