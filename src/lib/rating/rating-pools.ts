import { cache } from "react";

import { prisma } from "@/lib/db";

import type { SetClubPointsRow } from "./placement";

/**
 * Helpers shared by BOTH sports' rating data files (ratings-data.ts and
 * padel-ratings-data.ts) - the rating-pool (general / women's) plumbing and the
 * SET.club list utilities that don't depend on which sport's rows they run over.
 * Kept in one neutral module so a change to, say, the women's-pool eligibility
 * rule or the SET.club tiebreak can't be made for one sport and forgotten for
 * the other.
 */

/**
 * Which tournaments a rating computation draws its matches from -
 * "general" is every tournament except those marked `isWomensOnly`, "women" is
 * only those. A tournament belongs to exactly one pool, never both, so the two
 * pools' matches never overlap - see docs/RATING.md's women's-pool section.
 */
export type RatingScope = "general" | "women";

/**
 * Every player recorded as female (`Player.gender === "FEMALE"`) - used to
 * hide a beginner male's own row from the women's-pool tables. His matches
 * still feed the algorithm normally (his female partner/opponents get the
 * correct rating credit for actually having played him), he's just never
 * himself listed as a result - see docs/RATING.md's women's-pool section.
 * `cache()` dedupes this cheap query for the lifetime of one request.
 */
export const getFemalePlayerIds = cache(async (): Promise<Set<string>> => {
  const players = await prisma.player.findMany({ where: { gender: "FEMALE" }, select: { id: true } });
  return new Set(players.map((p) => p.id));
});

/** `null` for the general pool (no filtering at all) - only the women's pool hides non-female players. */
export async function femaleIdsForScope(scope: RatingScope): Promise<Set<string> | null> {
  return scope === "women" ? getFemalePlayerIds() : null;
}

/** Filters out any player not in `femaleIds` (a no-op when `femaleIds` is null, i.e. the general pool) - see getFemalePlayerIds. */
export function filterEligible<T extends { playerId: string }>(rows: T[], femaleIds: Set<string> | null): T[] {
  return femaleIds ? rows.filter((row) => femaleIds.has(row.playerId)) : rows;
}

/** SET.club ladder order: points, then more tournaments played, then a stable id tiebreak. */
export function sortSetClubPoints(rows: SetClubPointsRow[]): SetClubPointsRow[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.tournamentsPlayed - a.tournamentsPlayed || a.playerId.localeCompare(b.playerId),
  );
}

const ROLLING_WINDOW_MS = 52 * 7 * 24 * 60 * 60 * 1000;

/**
 * Rows for one SET.club period: the rolling 52-week window ("rolling") or one calendar year.
 * Ratings-data's ROLLING_SEASON / padel's PADEL_ROLLING_SEASON are both the literal "rolling".
 */
export function filterBySeason<T extends { tournamentStartDate: number }>(rows: T[], season: number | "rolling"): T[] {
  return season === "rolling"
    ? rows.filter((row) => row.tournamentStartDate >= Date.now() - ROLLING_WINDOW_MS)
    : rows.filter((row) => new Date(row.tournamentStartDate).getUTCFullYear() === season);
}
