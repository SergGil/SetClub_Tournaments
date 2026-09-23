import { NextResponse } from "next/server";

import { buildGiantKillerMatchIds, buildPlayerAchievements, toAchievementMatchInput } from "@/lib/achievements";
import type { AchievementMatchInput } from "@/lib/achievements";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPlayerMatches } from "@/lib/queries/matches";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import { getPlayerById } from "@/lib/queries/players";
import { getPadelUpsetWinsByPlayer } from "@/lib/rating/padel-ratings-data";
import { getUpsetWinsByPlayer } from "@/lib/rating/ratings-data";

type Params = { params: Promise<{ id: string }> };

/**
 * Player achievement badges (docs/ACHIEVEMENTS.md) - combined across tennis
 * + padel, singles + doubles (unlike rating-history's route just above,
 * there's no `sport`/`matchType` query param here: every badge in the v1
 * catalog is deliberately format-agnostic). No auth required, same as
 * GET /players/[id] - mirrors web's players/[id]/page.tsx computation
 * exactly so the mobile app and web profile never disagree on which badges
 * are earned.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return NextResponse.json({ error: "Гравця не знайдено" }, { status: 404 });

  const [
    matches,
    padelMatches,
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    padelSinglesUpsetsByPlayer,
    padelDoublesUpsetsByPlayer,
  ] = await Promise.all([
    getPlayerMatches(id),
    getPlayerPadelMatches(id),
    getUpsetWinsByPlayer("SINGLES"),
    getUpsetWinsByPlayer("DOUBLES"),
    getPadelUpsetWinsByPlayer("SINGLES"),
    getPadelUpsetWinsByPlayer("DOUBLES"),
  ]);

  const giantKillerMatchIds = buildGiantKillerMatchIds(id, [
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    padelSinglesUpsetsByPlayer,
    padelDoublesUpsetsByPlayer,
  ]);
  const achievementInputs = [...matches, ...padelMatches]
    .map((m) => toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id)))
    .filter((m): m is AchievementMatchInput => m !== null);

  return NextResponse.json({ achievements: buildPlayerAchievements(achievementInputs) });
});
