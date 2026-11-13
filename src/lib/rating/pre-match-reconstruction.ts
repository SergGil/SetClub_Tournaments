// Relative imports only (no "@/" alias, nothing from next/*) - this module is
// also loaded outside Next by scripts/backfill-pre-match-win-prob.ts.
import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import type { DoublesRatingRow, RatingMatchRow, SinglesRatingRow } from "./engine";
import { matchWinProbability } from "./match-preview";

export type ReconstructionRow = RatingMatchRow & {
  /** Epoch ms of when the result was saved (Match.completedAt) - orders matches WITHIN one tournament. */
  completedAt: number;
};

/** playerId -> rating, minus anyone the live getters' filterEligible would hide. */
function eligibleRatingMap<R>(
  final: Map<string, { playerId: string; rating: R }>,
  eligibleIds: Set<string> | null,
): Map<string, R> {
  return new Map(
    [...final.values()].filter((r) => !eligibleIds || eligibleIds.has(r.playerId)).map((r) => [r.playerId, r.rating]),
  );
}

/**
 * The per-format core of reconstructPreMatchWinProbs. `beforeTournament` is
 * the replay state after every earlier tournament - built once per
 * tournament and then extended, never recomputed - so each match only
 * replays its own tournament's earlier matches on top of it. Identical to
 * replaying all of history per match (see the `initial` contract on the
 * engine's compute*RatingsWithHistory), at roughly linear rather than
 * quadratic cost.
 */
function reconstructFormat<Row extends { playerId: string }>(
  tournaments: ReconstructionRow[][],
  replay: (rows: RatingMatchRow[], initial: Map<string, Row>) => Map<string, Row>,
  predict: (match: ReconstructionRow, ratings: Map<string, Row>) => number | null,
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  let beforeTournament = new Map<string, Row>();
  for (const rows of tournaments) {
    // Matches sharing a completedAt (a bulk-imported tournament) share a
    // prefix - replay it once.
    const byPrefix = new Map<number, Map<string, Row>>();
    for (const match of rows) {
      let ratings = byPrefix.get(match.completedAt);
      if (!ratings) {
        ratings = replay(
          rows.filter((r) => r.completedAt < match.completedAt),
          beforeTournament,
        );
        byPrefix.set(match.completedAt, ratings);
      }
      result.set(match.id, predict(match, ratings));
    }
    beforeTournament = replay(rows, beforeTournament);
  }
  return result;
}

/**
 * Side A's pre-match win probability for every already-completed match that
 * predates Match.preMatchWinProbA being frozen at save time - one rating pool
 * and one format at a time, `rows` being exactly what that pool's live
 * ratings are replayed from (same filters as fetchRatingMatchRows).
 *
 * For each match it rebuilds the ratings the scheduled-match preview would
 * have read just before that result went in: every match of every tournament
 * that comes EARLIER in the engine's own period order (start date, then id),
 * plus the matches of the SAME tournament completed before this one. For a
 * tournament scored live on the day that is exactly the live state at that
 * moment. Tournament order deliberately doesn't come from completedAt too:
 * the club's 2024-2025 history was typed in retroactively during Aug-Sep
 * 2026, so completedAt across tournaments is data-entry order, not play
 * order - by that clock a 2024 match would be "predicted" from 2025 results.
 *
 * Ties on completedAt (a bulk-imported tournament stamps every match the
 * same) count as "not before", so those matches all see the pre-tournament
 * ratings. `eligibleIds` mirrors filterEligible on the live getters (the
 * women's pool lists women only), so a match whose preview would have said
 * "Прогноз недоступний" maps to null here too.
 */
export function reconstructPreMatchWinProbs(
  rows: ReconstructionRow[],
  matchType: "SINGLES" | "DOUBLES",
  eligibleIds: Set<string> | null,
): Map<string, number | null> {
  const byTournament = new Map<string, { startDate: number; rows: ReconstructionRow[] }>();
  for (const row of rows) {
    const group = byTournament.get(row.tournamentId);
    if (group) group.rows.push(row);
    else byTournament.set(row.tournamentId, { startDate: row.tournamentStartDate, rows: [row] });
  }
  const tournaments = [...byTournament.entries()]
    .sort(([idA, a], [idB, b]) => a.startDate - b.startDate || idA.localeCompare(idB))
    .map(([, group]) => group.rows);

  if (matchType === "SINGLES") {
    return reconstructFormat<SinglesRatingRow>(
      tournaments,
      (replayRows, initial) => computeSinglesRatings(replayRows, initial),
      (match, ratings) =>
        matchWinProbability({ matchType, players: match.players }, eligibleRatingMap(ratings, eligibleIds), new Map())
          ?.probA ?? null,
    );
  }
  return reconstructFormat<DoublesRatingRow>(
    tournaments,
    (replayRows, initial) => computeDoublesRatings(replayRows, initial),
    (match, ratings) =>
      matchWinProbability({ matchType, players: match.players }, new Map(), eligibleRatingMap(ratings, eligibleIds))
        ?.probA ?? null,
  );
}
