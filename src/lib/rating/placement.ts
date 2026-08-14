import { FINAL_ROUND } from "@/lib/playoff-rounds";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";
import { sortRows } from "@/lib/standings-sort";

/** Shared across every Set Club variant (doubles, singles, ...): playerId or a per-tournament aggregate, plus a season total. */
export type SetClubPointsRow = { playerId: string; points: number; tournamentsPlayed: number };

/**
 * Playoff round -> [winnerPlace, loserPlace]. Only these six rounds resolve
 * an exact tournament place; "1/8"/"1/4"/"1/2" are feeder stages that don't
 * decide a place on their own - see docs/RATING.md's Set Club section.
 */
export const PLACEMENT_ROUND_RANKS: Record<string, [number, number]> = {
  [FINAL_ROUND]: [1, 2],
  "За 3 місце": [3, 4],
  "За 5 місце": [5, 6],
  "За 7 місце": [7, 8],
  "За 9 місце": [9, 10],
  "За 11 місце": [11, 12],
};

export type PlayoffResult = { round: string; winnerKey: string; loserKey: string };

/**
 * The decisive-match half of resolvePlacements, extracted so other callers
 * (e.g. the "GROUPS_12_PLAYOFF" combined 1-12 table in
 * tournament-standings.ts - see docs/GROUPS12_PLAYOFF.md) can resolve just
 * the places actual playoff matches decided, without pulling in
 * resolvePlacements' own round-robin fallback for whichever places those
 * matches left undecided.
 */
export function resolveDecisivePlacements(playoffResults: PlayoffResult[]): Map<string, number> {
  const placeByKey = new Map<string, number>();
  // Match creation now rejects a second match with the same placement round
  // in one tournament, but this stays defensive against pre-existing bad
  // data: without it, two matches sharing a round would double-assign that
  // round's places and leave the place(s) it should have decided empty.
  const usedRounds = new Set<string>();
  for (const { round, winnerKey, loserKey } of playoffResults) {
    const ranks = PLACEMENT_ROUND_RANKS[round];
    if (!ranks || usedRounds.has(round)) continue;
    usedRounds.add(round);
    placeByKey.set(winnerKey, ranks[0]);
    placeByKey.set(loserKey, ranks[1]);
  }
  return placeByKey;
}

/**
 * Fills whichever places `placeByKey` doesn't already have (mutated in
 * place) using round-robin standings order (`sortRows`/`HeadToHead` - the
 * same ranking the live Таблиця tab shows) among the rest of `unitKeys`.
 * Handles gaps (e.g. Фінал+За 3 decided but no За 5) without assuming the
 * already-decided places form a contiguous block. Shared tail of
 * `resolvePlacements` below - split out so a caller that needs to seed
 * `placeByKey` with something *other* than just decisive playoff matches
 * first (e.g. singles' GROUPS_12_PLAYOFF mini-group, see setclub-singles.ts)
 * can still reuse this exact "everyone else, ranked by record" fallback.
 */
export function fillRemainingPlacements(
  unitKeys: string[],
  standingsRows: Map<string, StandingsRow>,
  h2h: HeadToHead,
  placeByKey: Map<string, number>,
): void {
  const total = unitKeys.length;
  const usedPlaces = new Set([...placeByKey.values()].filter((p) => p >= 1 && p <= total));
  const remainingPlaces = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !usedPlaces.has(p));
  const remainingRows = unitKeys
    .filter((key) => !placeByKey.has(key))
    .map((key) => standingsRows.get(key)!);
  sortRows(remainingRows, h2h).forEach((row, i) => {
    const place = remainingPlaces[i];
    if (place !== undefined) placeByKey.set(row.key, place);
  });
}

/**
 * Resolves an exact 1..unitKeys.length place for every unit (a doubles pair
 * or a single player), from decisive playoff matches first, then filling
 * whichever places those matches didn't decide via round-robin standings
 * order.
 */
export function resolvePlacements(
  unitKeys: string[],
  standingsRows: Map<string, StandingsRow>,
  h2h: HeadToHead,
  playoffResults: PlayoffResult[],
): Map<string, number> {
  const placeByKey = resolveDecisivePlacements(playoffResults);
  fillRemainingPlacements(unitKeys, standingsRows, h2h, placeByKey);
  return placeByKey;
}

/**
 * Points for finishing `place` out of `total` units (doubles pairs or
 * singles players) - the shared Set Club ladder: `2 × (total − place + 1)`,
 * i.e. 2 points per place going up from the bottom. Clamped at 0 in case a
 * mislabeled placement round would otherwise put `place` above `total`.
 */
export function placePoints(place: number, total: number): number {
  return Math.max(0, 2 * (total - place + 1));
}

/**
 * Combines several already-sorted SetClubPointsRow[] lists (e.g. Tennis's
 * getSinglesSetClubPoints and Padel's getPadelSinglesSetClubPoints for the
 * same season) into one club-wide ranking: a player who appears in more than
 * one list (the roster is shared - see the Player model comment - a member
 * can play both sports) gets their points and tournamentsPlayed summed
 * rather than counted once per sport. Same points-desc/tournaments-desc/
 * playerId-asc order as ratings-data.ts's private sortSetClubPoints, so a
 * merged list drops into any caller that already expects "index 0 is the
 * leader" (e.g. season-card-data.ts).
 */
export function mergeSetClubPoints(...lists: SetClubPointsRow[][]): SetClubPointsRow[] {
  const byPlayer = new Map<string, SetClubPointsRow>();
  for (const list of lists) {
    for (const row of list) {
      const existing = byPlayer.get(row.playerId);
      if (existing) {
        existing.points += row.points;
        existing.tournamentsPlayed += row.tournamentsPlayed;
      } else {
        byPlayer.set(row.playerId, { ...row });
      }
    }
  }
  return [...byPlayer.values()].sort(
    (a, b) => b.points - a.points || b.tournamentsPlayed - a.tournamentsPlayed || a.playerId.localeCompare(b.playerId),
  );
}
