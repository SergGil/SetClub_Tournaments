import { after } from "next/server";

import { prisma } from "@/lib/db";

import { computeDoublesRatingsWithHistory, computeSinglesRatingsWithHistory } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal, displaySpread } from "./openskill";
import { fetchRatingMatchRows, SNAPSHOT_POOL } from "./ratings-data";
import type { RatingScope } from "./ratings-data";

// SNAPSHOT_POOL (ratings-data.ts) is the single source of truth for the
// RatingScope -> RatingPool mapping - reused here rather than a second
// literal, so the two can't silently drift apart.
const SCOPES = (Object.keys(SNAPSHOT_POOL) as RatingScope[]).map((scope) => ({
  scope,
  pool: SNAPSHOT_POOL[scope],
}));

/**
 * Fully rebuilds RatingSnapshot from the current match history - not an
 * incremental update. RatingSnapshot is a derived cache, never a source of
 * truth (see the model's doc comment in schema.prisma), so a wipe-and-
 * reinsert is both simpler and safer than diffing: it can't drift from what
 * computeSinglesRatings/computeDoublesRatings would report even after an old
 * match gets edited or deleted. Cheap at this club's scale (a few hundred
 * rows even after years of tournaments).
 *
 * Rebuilds both rating pools (general + women, see Tournament.isWomensOnly) -
 * a tournament's matches only ever feed one of the two, so the two pools'
 * rows never collide on the [playerId, matchType, tournamentId] unique
 * constraint.
 */
export async function refreshRatingSnapshots(): Promise<void> {
  const rows = (
    await Promise.all(
      SCOPES.map(async ({ scope, pool }) => {
        const [singlesRows, doublesRows] = await Promise.all([
          fetchRatingMatchRows("SINGLES", scope),
          fetchRatingMatchRows("DOUBLES", scope),
        ]);
        const singles = computeSinglesRatingsWithHistory(singlesRows);
        const doubles = computeDoublesRatingsWithHistory(doublesRows);
        return [
          ...singles.snapshots.map((s) => ({
            playerId: s.playerId,
            matchType: "SINGLES" as const,
            pool,
            tournamentId: s.tournamentId,
            asOfDate: new Date(s.asOfDate),
            // Already display-ready - the same numbers /rating and the player
            // profile show, so a chart can plot these directly.
            rating: Math.round(conservativeRating(s.rating)),
            spread: Math.round(s.rating.rd),
          })),
          ...doubles.snapshots.map((s) => ({
            playerId: s.playerId,
            matchType: "DOUBLES" as const,
            pool,
            tournamentId: s.tournamentId,
            asOfDate: new Date(s.asOfDate),
            rating: Math.round(conservativeOrdinal(s.rating)),
            spread: Math.round(displaySpread(s.rating.sigma)),
          })),
        ];
      }),
    )
  ).flat();

  // Two mutations in quick succession each schedule their own after()
  // refresh; without serializing them, both transactions can delete the
  // (disjoint, already-committed) rows the other just inserted and then
  // collide on the unique constraint when they insert their own set,
  // failing the second refresh outright (best-effort per the comment above,
  // so it's swallowed - but it leaves the snapshot table on the *older* of
  // the two computations until the next mutation retries it). Same
  // pg_advisory_xact_lock pattern already used for the randomizer commits in
  // src/lib/actions/matches.ts, keyed by a fixed string since this lock
  // guards the single global table, not a per-tournament row set.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rating_snapshot_refresh'), 0)`;
    await tx.ratingSnapshot.deleteMany({});
    await tx.ratingSnapshot.createMany({ data: rows });
  });
}

/**
 * Schedules a full RatingSnapshot rebuild after the current response is
 * sent - call this alongside every `updateTag(STATS_CACHE_TAG)` in
 * src/lib/actions/{matches,tournaments}.ts. Best-effort like logAudit: a
 * failure here shouldn't fail the mutation that already succeeded.
 */
export function scheduleRatingSnapshotRefresh(): void {
  after(() => refreshRatingSnapshots().catch((error) => {
    console.error("Failed to refresh rating snapshots", error);
  }));
}
