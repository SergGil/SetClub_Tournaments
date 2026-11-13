import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import { matchWinProbability } from "./match-preview";
import { fetchPadelRatingMatchRows } from "./padel-ratings-data";
import { eligibleIdsFor, filterEligible } from "./rating-pools";
import { fetchRatingMatchRows } from "./ratings-data";

export type PreMatchPredictionInput = {
  /** Excluded from the replay - see computePreMatchWinProbA. */
  id: string;
  matchType: MatchType;
  players: { side: "A" | "B"; playerId: string }[];
  /** The match's own tournament - picks the rating pool exactly like the tournament page's `ratingScope` does. */
  tournament: { isWomensOnly: boolean };
};

function ratingById<T>(rows: { playerId: string; rating: T }[]): Map<string, T> {
  return new Map(rows.map((r) => [r.playerId, r.rating]));
}

/**
 * Side A's win probability exactly as the scheduled-match preview showed it
 * right before this match's result was saved: the same pool's rating rows,
 * the same eligibility filter and formula as getSinglesRatings/
 * getDoublesRatings + buildMatchPreview, replayed WITHOUT this match. Run
 * after the score write (see freezePreMatchWinProbA), the rows already
 * contain the match, so dropping it gives back the state the preview read;
 * should the rows still be the cached pre-write ones, it isn't in them and
 * dropping it is a no-op - the same answer either way.
 */
export async function computePreMatchWinProbA(
  sport: "TENNIS" | "PADEL",
  match: PreMatchPredictionInput,
): Promise<number | null> {
  const scope = match.tournament.isWomensOnly ? "women" : "general";
  const fetchRows = sport === "PADEL" ? fetchPadelRatingMatchRows : fetchRatingMatchRows;
  const [rows, eligibleIds] = await Promise.all([fetchRows(match.matchType, scope), eligibleIdsFor(scope)]);
  const before = rows.filter((row) => row.id !== match.id);
  const probability =
    match.matchType === "SINGLES"
      ? matchWinProbability(
          match,
          ratingById(filterEligible([...computeSinglesRatings(before).values()], eligibleIds)),
          new Map(),
        )
      : matchWinProbability(
          match,
          new Map(),
          ratingById(filterEligible([...computeDoublesRatings(before).values()], eligibleIds)),
        );
  return probability?.probA ?? null;
}

/**
 * Freezes Match.preMatchWinProbA for a match whose result was just saved for
 * the first time - scheduled by saveScoreCore/savePadelScoreCore through
 * `after()`, so the rating replay never adds to the score-save response time.
 * `completedAt` is the timestamp that save stamped.
 *
 * Written with raw SQL rather than updateMany: Prisma would bump the
 * @updatedAt column, which is the score form's optimistic-concurrency token
 * (expectedUpdatedAt) - the admin's next correction would then be rejected as
 * "changed elsewhere". The WHERE clause only fills the completion the value
 * was computed for: if the score was cleared meanwhile (status no longer
 * COMPLETED), or cleared and saved again (a new completedAt), nothing is
 * written. Never throws - a failure just leaves the prediction empty, which
 * scripts/backfill-pre-match-win-prob.ts can fill later.
 */
export async function freezePreMatchWinProbA(
  sport: "TENNIS" | "PADEL",
  match: PreMatchPredictionInput & { completedAt: Date },
): Promise<void> {
  try {
    const probA = await computePreMatchWinProbA(sport, match);
    if (probA == null) return; // the save already left the column NULL
    if (sport === "PADEL") {
      await prisma.$executeRaw`UPDATE "padel_matches" SET "preMatchWinProbA" = ${probA} WHERE "id" = ${match.id} AND "status" = 'COMPLETED' AND "completedAt" = ${match.completedAt} AND "preMatchWinProbA" IS NULL`;
    } else {
      await prisma.$executeRaw`UPDATE "matches" SET "preMatchWinProbA" = ${probA} WHERE "id" = ${match.id} AND "status" = 'COMPLETED' AND "completedAt" = ${match.completedAt} AND "preMatchWinProbA" IS NULL`;
    }
  } catch (error) {
    console.error("freezePreMatchWinProbA failed - the match keeps no frozen prediction", error);
  }
}
