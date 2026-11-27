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

/** Every snapshot row (both rating pools), replayed from the current match history. */
async function computeSnapshotRows() {
  return (
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
}

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
  // Two mutations in quick succession each schedule their own after()
  // refresh; without serializing them, both transactions can delete the
  // (disjoint, already-committed) rows the other just inserted and then
  // collide on the unique constraint when they insert their own set,
  // failing the second refresh outright (best-effort per the comment above,
  // so it's swallowed - but it leaves the snapshot table on the *older* of
  // the two computations until the next mutation retries it). Same
  // pg_advisory_xact_lock pattern the randomizer commits use
  // (src/lib/actions/randomize-*.ts), keyed by a fixed string since this lock
  // guards the single global table, not a per-tournament row set.
  // The rows are computed only once the lock is held: computed before it (as
  // this used to), two refreshes could still write in the opposite order of
  // the data they had read, leaving the table on the older computation. Under
  // the lock each refresh reads whatever was committed by the time it got its
  // turn - always at least what the previous holder saw. The timeout leaves
  // room for waiting on the lock plus the replay itself.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rating_snapshot_refresh'), 0)`;
      const rows = await computeSnapshotRows();
      await tx.ratingSnapshot.deleteMany({});
      await tx.ratingSnapshot.createMany({ data: rows });
    },
    { timeout: 30_000 },
  );
}

/**
 * Schedules a full RatingSnapshot rebuild after the current response is
 * sent - call this alongside every `expireCacheTag(STATS_CACHE_TAG)` in
 * src/lib/actions/{matches,tournaments}.ts. Best-effort like logAudit: a
 * failure here shouldn't fail the mutation that already succeeded.
 */
export function scheduleRatingSnapshotRefresh(): void {
  after(() => refreshRatingSnapshots().catch((error) => {
    console.error("Failed to refresh rating snapshots", error);
  }));
}
