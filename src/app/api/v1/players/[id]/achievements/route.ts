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
 * Player achievement badges (docs/ACHIEVEMENTS.md) for ONE sport, singles +
 * doubles combined: `?sport=padel` for the padel badges, tennis otherwise
 * (default). No `matchType` param - every badge counts both formats. No auth
 * required, same as GET /players/[id] - mirrors the web profiles
 * (players/[id]/page.tsx for tennis, padel/players/[id]/page.tsx for padel)
 * exactly so the mobile app and web never disagree on which badges are
 * earned.
 */
export const GET = withApiErrorHandling(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return NextResponse.json({ error: "Гравця не знайдено" }, { status: 404 });

  // Achievements are per sport (docs/ACHIEVEMENTS.md): `?sport=padel` for the padel ones,
  // tennis (the default - the mobile profile screen is tennis) otherwise.
  const sport = new URL(request.url).searchParams.get("sport") === "padel" ? "padel" : "tennis";
  const upsetScopes = ["general", "women"] as const;
  const [matches, upsetIndexes, womensOnlyTournamentIds] = await Promise.all([
    sport === "padel" ? getPlayerPadelMatches(id) : getPlayerMatches(id),
    // Women's-pool upsets too - same inputs as the web profiles, so the mobile app and the
    // web never disagree on "Вбивця фаворитів".
    Promise.all(
      upsetScopes.flatMap((scope) =>
        (["SINGLES", "DOUBLES"] as const).map((matchType) =>
          sport === "padel" ? getPadelUpsetWinsByPlayer(matchType, scope) : getUpsetWinsByPlayer(matchType, scope),
        ),
      ),
    ),
    sport === "padel" ? getPadelWomensOnlyTournamentIds() : getWomensOnlyTournamentIds(),
  ]);

  const giantKillerMatchIds = buildGiantKillerMatchIds(id, upsetIndexes);
  const achievementInputs = matches
    .map((m) =>
      toAchievementMatchInput(m, id, giantKillerMatchIds.has(m.id), {
        sport,
        womensOnly: womensOnlyTournamentIds.has(m.tournamentId),
      }),
    )
    .filter((m): m is AchievementMatchInput => m !== null);

  return NextResponse.json({ achievements: buildPlayerAchievements(achievementInputs, { playerId: id, gender: player.gender, sport }) });
});
