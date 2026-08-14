import type { SetClubPointsRow } from "@/lib/rating/placement";

export type SeasonShareData = {
  year: number;
  matchesPlayed: number;
  tournamentsCompleted: number;
  topSingles: { name: string; points: number } | null;
  topDoubles: { name: string; points: number } | null;
};

/**
 * Shapes a calendar year's club-wide activity into plain data for the
 * "Рік у SET.club" share card (src/lib/share/season-card-image.tsx). Takes
 * `singlesPoints`/`doublesPoints` already sorted (as getSinglesSetClubPoints/
 * getDoublesSetClubPoints from src/lib/rating/ratings-data.ts already return
 * them - or, per the route, mergeSetClubPoints'd together with their Padel
 * twins so a club-wide leader isn't just Tennis's) - index 0 is that
 * format's season leader.
 *
 * Returns null when the year has no decided matches at all - nothing
 * meaningful to recap.
 */
export function buildSeasonShareData(
  year: number,
  matchesPlayed: number,
  tournamentsCompleted: number,
  singlesPoints: SetClubPointsRow[],
  doublesPoints: SetClubPointsRow[],
  nameById: Map<string, string>,
): SeasonShareData | null {
  if (matchesPlayed === 0) return null;

  function topOf(rows: SetClubPointsRow[]): { name: string; points: number } | null {
    const top = rows[0];
    if (!top) return null;
    const name = nameById.get(top.playerId);
    return name ? { name, points: top.points } : null;
  }

  return {
    year,
    matchesPlayed,
    tournamentsCompleted,
    topSingles: topOf(singlesPoints),
    topDoubles: topOf(doublesPoints),
  };
}
