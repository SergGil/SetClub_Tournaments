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

  await prisma.$transaction([
    prisma.ratingSnapshot.deleteMany({}),
    prisma.ratingSnapshot.createMany({ data: rows }),
  ]);
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
