import { after } from "next/server";

import { prisma } from "@/lib/db";

import { computeDoublesRatingsWithHistory, computeSinglesRatingsWithHistory } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal, displaySpread } from "./openskill";
import { fetchPadelRatingMatchRows } from "./padel-ratings-data";
import { SNAPSHOT_POOL } from "./ratings-data";
import type { RatingScope } from "./ratings-data";

// SNAPSHOT_POOL (ratings-data.ts) is the single source of truth for the
// RatingScope -> RatingPool mapping, shared with Tennis's snapshot.ts.
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
          fetchPadelRatingMatchRows("SINGLES", scope),
          fetchPadelRatingMatchRows("DOUBLES", scope),
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
 * Padel twin of refreshRatingSnapshots - fully rebuilds PadelRatingSnapshot
 * from the current Padel match history, reusing the exact same Glicko-2/
 * OpenSkill computation (engine.ts) as Tennis. See snapshot.ts for the full
 * "wipe and reinsert, not incremental" rationale.
 *
 * Rebuilds both rating pools (general + women, see
 * PadelTournament.isWomensOnly) - a tournament's matches only ever feed one
 * of the two, so the pools' rows never collide on the
 * [playerId, matchType, tournamentId] unique constraint.
 */
export async function refreshPadelRatingSnapshots(): Promise<void> {
  // Same per-refresh advisory lock as refreshRatingSnapshots, keyed by a
  // distinct string so a Tennis refresh and a Padel refresh in flight at the
  // same time don't serialize against each other unnecessarily - they touch
  // entirely disjoint tables.
  // The rows are computed only once the lock is held: computed before it (as
  // this used to), two refreshes could still write in the opposite order of
  // the data they had read, leaving the table on the older computation. Under
  // the lock each refresh reads whatever was committed by the time it got its
  // turn - always at least what the previous holder saw. The timeout leaves
  // room for waiting on the lock plus the replay itself.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('padel_rating_snapshot_refresh'), 0)`;
      const rows = await computeSnapshotRows();
      await tx.padelRatingSnapshot.deleteMany({});
      await tx.padelRatingSnapshot.createMany({ data: rows });
    },
    { timeout: 30_000 },
  );
}

/**
 * Schedules a full PadelRatingSnapshot rebuild after the current response is
 * sent - call this alongside every `expireCacheTag(PADEL_STATS_CACHE_TAG)` in
 * src/lib/actions/padel-{matches,tournaments}.ts. Best-effort like logAudit.
 */
export function schedulePadelRatingSnapshotRefresh(): void {
  after(() => refreshPadelRatingSnapshots().catch((error) => {
    console.error("Failed to refresh Padel rating snapshots", error);
  }));
}
