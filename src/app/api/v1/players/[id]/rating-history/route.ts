import { NextResponse } from "next/server";

import { withApiErrorHandling } from "@/lib/api-auth";
import type { MatchType } from "@/generated/prisma/enums";
import { getPlayerPadelRatingHistory } from "@/lib/rating/padel-ratings-data";
import { getPlayerRatingHistory } from "@/lib/rating/ratings-data";

type Params = { params: Promise<{ id: string }> };

/**
 * `?matchType=SINGLES|DOUBLES&sport=tennis|padel` (sport defaults to tennis) -
 * powers the mobile app's player-compare screen (mirrors web's /rating/compare,
 * which calls getPlayerRatingHistory/getPlayerPadelRatingHistory directly as a
 * Server Component - this route is the JSON equivalent for the RN client,
 * same read, no auth required, same as GET /players/[id]). No public web page
 * links here directly; docs/MOBILE_APP.md documents the route for the app.
 */
export const GET = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const matchTypeParam = searchParams.get("matchType");
  const matchType: MatchType = matchTypeParam === "DOUBLES" ? "DOUBLES" : "SINGLES";
  const sport = searchParams.get("sport") === "padel" ? "padel" : "tennis";

  const history =
    sport === "padel" ? await getPlayerPadelRatingHistory(id, matchType) : await getPlayerRatingHistory(id, matchType);

  return NextResponse.json({ history });
});
