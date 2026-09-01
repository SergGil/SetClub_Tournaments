import { NextResponse } from "next/server";

import type { MatchType } from "@/generated/prisma/enums";
import { withApiErrorHandling } from "@/lib/api-auth";
import {
  getAllPadelPlayerStats,
  getPadelHeadToHeadMatchRows,
  getPadelMonthlyActivity,
  getPadelResultYears,
} from "@/lib/padel-stats";

/** Padel twin of GET /api/v1/leaderboard. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const matchType = typeParam === "SINGLES" || typeParam === "DOUBLES" ? (typeParam as MatchType) : undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  const [stats, headToHead, monthlyActivity, years] = await Promise.all([
    getAllPadelPlayerStats(matchType, year),
    getPadelHeadToHeadMatchRows(matchType, year),
    getPadelMonthlyActivity(),
    getPadelResultYears(),
  ]);

  return NextResponse.json({
    stats: Object.fromEntries(stats),
    headToHead,
    monthlyActivity,
    years,
  });
});
