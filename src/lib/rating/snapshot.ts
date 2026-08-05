import { after } from "next/server";

import { prisma } from "@/lib/db";

import { computeDoublesRatingsWithHistory, computeSinglesRatingsWithHistory } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal, displaySpread } from "./openskill";
import { fetchRatingMatchRows } from "./ratings-data";

/**
 * Fully rebuilds RatingSnapshot from the current match history - not an
 * incremental update. RatingSnapshot is a derived cache, never a source of
 * truth (see the model's doc comment in schema.prisma), so a wipe-and-
 * reinsert is both simpler and safer than diffing: it can't drift from what
 * computeSinglesRatings/computeDoublesRatings would report even after an old
 * match gets edited or deleted. Cheap at this club's scale (a few hundred
 * rows even after years of tournaments).
 */
export async function refreshRatingSnapshots(): Promise<void> {
  const [singlesRows, doublesRows] = await Promise.all([
    fetchRatingMatchRows("SINGLES"),
    fetchRatingMatchRows("DOUBLES"),
  ]);

  const singles = computeSinglesRatingsWithHistory(singlesRows);
  const doubles = computeDoublesRatingsWithHistory(doublesRows);

  const rows = [
    ...singles.snapshots.map((s) => ({
      playerId: s.playerId,
      matchType: "SINGLES" as const,
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
      tournamentId: s.tournamentId,
      asOfDate: new Date(s.asOfDate),
      rating: Math.round(conservativeOrdinal(s.rating)),
      spread: Math.round(displaySpread(s.rating.sigma)),
    })),
  ];

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
