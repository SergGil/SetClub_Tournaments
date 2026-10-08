import { NextResponse } from "next/server";

import { PUBLIC_API_CACHE, withApiErrorHandling } from "@/lib/api-auth";
import { loadPlayerAchievements } from "@/lib/player-achievements-data";
import { getPlayerMatches } from "@/lib/queries/matches";
import { getPlayerPadelMatches } from "@/lib/queries/padel-matches";
import { getPadelWomensOnlyTournamentIds } from "@/lib/queries/padel-tournaments";
import { getPlayerById } from "@/lib/queries/players";
import { getWomensOnlyTournamentIds } from "@/lib/queries/tournaments";
import { PUBLIC_READ_LIMIT, withRateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

/**
 * Player achievement badges (docs/ACHIEVEMENTS.md) for ONE sport, singles +
 * doubles combined: `?sport=padel` for the padel badges, tennis otherwise
 * (default). No `matchType` param - every badge counts both formats. No auth
 * required, same as GET /players/[id]. Built by the same loadPlayerAchievements
 * the web profiles (players/[id]/page.tsx for tennis,
 * padel/players/[id]/page.tsx for padel) use, so the mobile app and web never
 * disagree on which badges are earned.
 */
export const GET = withApiErrorHandling(withRateLimit(PUBLIC_READ_LIMIT, async (request: Request, { params }: Params) => {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) return NextResponse.json({ error: "Гравця не знайдено" }, { status: 404 });

  const sportParam = new URL(request.url).searchParams.get("sport");
  if (sportParam !== null && sportParam !== "padel" && sportParam !== "tennis") {
    return NextResponse.json({ error: "sport має бути \"tennis\" або \"padel\"" }, { status: 400 });
  }
  const sport = sportParam === "padel" ? "padel" : "tennis";

  const [matches, womensOnlyTournamentIds] = await Promise.all([
    sport === "padel" ? getPlayerPadelMatches(id) : getPlayerMatches(id),
    sport === "padel" ? getPadelWomensOnlyTournamentIds() : getWomensOnlyTournamentIds(),
  ]);
  const achievements = await loadPlayerAchievements({
    sport,
    playerId: id,
    gender: player.gender,
    matches,
    womensOnlyTournamentIds,
  });
  return NextResponse.json({ achievements }, { headers: PUBLIC_API_CACHE });
}));
