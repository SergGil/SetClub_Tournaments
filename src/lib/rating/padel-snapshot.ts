import { after } from "next/server";

import { prisma } from "@/lib/db";

import { computeDoublesRatingsWithHistory, computeSinglesRatingsWithHistory } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal, displaySpread } from "./openskill";
import { fetchPadelRatingMatchRows } from "./padel-ratings-data";

/**
 * Padel twin of refreshRatingSnapshots - fully rebuilds PadelRatingSnapshot
 * from the current Padel match history, reusing the exact same Glicko-2/
 * OpenSkill computation (engine.ts) as Tennis. See snapshot.ts for the full
 * "wipe and reinsert, not incremental" rationale.
 */
export async function refreshPadelRatingSnapshots(): Promise<void> {
  const [singlesRows, doublesRows] = await Promise.all([
    fetchPadelRatingMatchRows("SINGLES"),
    fetchPadelRatingMatchRows("DOUBLES"),
  ]);

  const singles = computeSinglesRatingsWithHistory(singlesRows);
  const doubles = computeDoublesRatingsWithHistory(doublesRows);

  const rows = [
    ...singles.snapshots.map((s) => ({
      playerId: s.playerId,
      matchType: "SINGLES" as const,
      tournamentId: s.tournamentId,
      asOfDate: new Date(s.asOfDate),
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

  // Same per-refresh advisory lock as refreshRatingSnapshots, keyed by a
  // distinct string so a Tennis refresh and a Padel refresh in flight at the
  // same time don't serialize against each other unnecessarily - they touch
  // entirely disjoint tables.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('padel_rating_snapshot_refresh'), 0)`;
    await tx.padelRatingSnapshot.deleteMany({});
    await tx.padelRatingSnapshot.createMany({ data: rows });
  });
}

/**
 * Schedules a full PadelRatingSnapshot rebuild after the current response is
 * sent - call this alongside every `updateTag(PADEL_STATS_CACHE_TAG)` in
 * src/lib/actions/padel-{matches,tournaments}.ts. Best-effort like logAudit.
 */
export function schedulePadelRatingSnapshotRefresh(): void {
  after(() => refreshPadelRatingSnapshots().catch((error) => {
    console.error("Failed to refresh Padel rating snapshots", error);
  }));
}
