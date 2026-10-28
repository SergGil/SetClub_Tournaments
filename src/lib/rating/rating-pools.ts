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

/**
 * The general pool's optional "Стать" filter on /rating and /padel/rating -
 * the general pool is open to everyone, so unlike the women's pool it has no
 * gender rule of its own. Same read-time "hide the player, not the match"
 * mechanism as the women's pool: every rating is still computed over every
 * general-pool match, the filter only narrows which rows are listed - and,
 * since each list function filters before it sorts or diffs, places and
 * trend arrows are re-counted among the players left. Ignored for the
 * women's pool, which always lists women only.
 */
export type GenderFilter = "all" | "male" | "female";

/**
 * Every player NOT recorded as female - the "male" GenderFilter. The exact
 * complement of getFemalePlayerIds (an unset gender counts here), so
 * "Чоловіки" + "Жінки" always add up to "Усі" and a player whose gender was
 * never recorded can't vanish from both filtered lists.
 */
export const getNonFemalePlayerIds = cache(async (): Promise<Set<string>> => {
  const players = await prisma.player.findMany({
    // Not `gender: { not: "FEMALE" }` alone - that comparison silently drops NULL rows.
    where: { OR: [{ gender: "MALE" }, { gender: null }] },
    select: { id: true },
  });
  return new Set(players.map((p) => p.id));
});

/** femaleIdsForScope, narrowed further by the general pool's GenderFilter - `null` means no filtering at all. */
export async function eligibleIdsFor(scope: RatingScope, gender: GenderFilter = "all"): Promise<Set<string> | null> {
  if (scope === "women" || gender === "female") return getFemalePlayerIds();
  if (gender === "male") return getNonFemalePlayerIds();
  return null;
}

/** Filters out any player not in `eligibleIds` (a no-op when it's null, i.e. the unfiltered general pool) - see eligibleIdsFor. */
export function filterEligible<T extends { playerId: string }>(rows: T[], eligibleIds: Set<string> | null): T[] {
  return eligibleIds ? rows.filter((row) => eligibleIds.has(row.playerId)) : rows;
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
