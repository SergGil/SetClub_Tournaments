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
 * Resolves an exact 1..unitKeys.length place for every unit (a doubles pair
 * or a single player), from decisive playoff matches first, then filling
 * whichever places those matches didn't decide via round-robin standings
 * order (`sortRows`/`HeadToHead` - the same ranking the live Таблиця tab
 * shows). Handles gaps (e.g. Фінал+За 3 decided but no За 5) without
 * assuming the decided places form a contiguous block.
 */
export function resolvePlacements(
  unitKeys: string[],
  standingsRows: Map<string, StandingsRow>,
  h2h: HeadToHead,
  playoffResults: PlayoffResult[],
): Map<string, number> {
  const total = unitKeys.length;
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

  const usedPlaces = new Set([...placeByKey.values()].filter((p) => p >= 1 && p <= total));
  const remainingPlaces = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !usedPlaces.has(p));
  const remainingRows = unitKeys
    .filter((key) => !placeByKey.has(key))
    .map((key) => standingsRows.get(key)!);
  sortRows(remainingRows, h2h).forEach((row, i) => {
    const place = remainingPlaces[i];
    if (place !== undefined) placeByKey.set(row.key, place);
  });

  return placeByKey;
}
