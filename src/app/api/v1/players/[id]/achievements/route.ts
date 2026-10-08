import { NextResponse } from "next/server";

import { buildGiantKillerMatchIds, buildPlayerAchievements, toAchievementMatchInput } from "@/lib/achievements";
import type { AchievementMatchInput } from "@/lib/achievements";
import { withApiErrorHandling } from "@/lib/api-auth";
import { getPlayerMatches } from "@/lib/queries/matches";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import { getPadelWomensOnlyTournamentIds } from "@/lib/queries/padel-tournaments";
import { getPlayerById } from "@/lib/queries/players";
import { getWomensOnlyTournamentIds } from "@/lib/queries/tournaments";
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
    womenSinglesUpsetsByPlayer,
    womenDoublesUpsetsByPlayer,
    padelWomenSinglesUpsetsByPlayer,
    padelWomenDoublesUpsetsByPlayer,
    womensOnlyTournamentIds,
    padelWomensOnlyTournamentIds,
  ] = await Promise.all([
    getPlayerMatches(id),
    getPlayerPadelMatches(id),
    getUpsetWinsByPlayer("SINGLES"),
    getUpsetWinsByPlayer("DOUBLES"),
    getPadelUpsetWinsByPlayer("SINGLES"),
    getPadelUpsetWinsByPlayer("DOUBLES"),
    // Women's-pool upsets too - same inputs as the web profile (players/[id]/page.tsx), so the
    // mobile app and the web never disagree on "Вбивця фаворитів".
    getUpsetWinsByPlayer("SINGLES", "women"),
    getUpsetWinsByPlayer("DOUBLES", "women"),
    getPadelUpsetWinsByPlayer("SINGLES", "women"),
    getPadelUpsetWinsByPlayer("DOUBLES", "women"),
    getWomensOnlyTournamentIds(),
    getPadelWomensOnlyTournamentIds(),
  ]);

  const giantKillerMatchIds = buildGiantKillerMatchIds(id, [
    singlesUpsetsByPlayer,
    doublesUpsetsByPlayer,
    padelSinglesUpsetsByPlayer,
    padelDoublesUpsetsByPlayer,
    womenSinglesUpsetsByPlayer,
    womenDoublesUpsetsByPlayer,
    padelWomenSinglesUpsetsByPlayer,
    padelWomenDoublesUpsetsByPlayer,
  ]);
  const achievementInputs = [
    ...matches.map((m) =>
      toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id), {
        sport: "tennis",
        womensOnly: womensOnlyTournamentIds.has(m.tournamentId),
      }),
    ),
    ...padelMatches.map((m) =>
      toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id), {
        sport: "padel",
        womensOnly: padelWomensOnlyTournamentIds.has(m.tournamentId),
      }),
    ),
  ].filter((m): m is AchievementMatchInput => m !== null);

  return NextResponse.json({ achievements: buildPlayerAchievements(achievementInputs, { playerId: id, gender: player.gender }) });
});
