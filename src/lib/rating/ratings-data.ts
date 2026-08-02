import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { STATS_CACHE_TAG } from "@/lib/stats";

import { computeDoublesRatings, computeSinglesRatings } from "./engine";
import type { DoublesRatingRow, RatingMatchRow, SinglesRatingRow } from "./engine";
import { conservativeRating } from "./glicko2";
import { conservativeOrdinal } from "./openskill";

// Reuses stats.ts's cache tag rather than introducing a new one: ratings are
// derived from the exact same "decided match" row set and invalidated by the
// exact same set of match-mutating actions, so a second tag would just be
// updateTag'd in lockstep everywhere the first one already is.
const CACHE_OPTIONS = { tags: [STATS_CACHE_TAG], revalidate: 60 };

const matchSelect = {
  id: true,
  tournamentId: true,
  tournament: { select: { startDate: true } },
  winnerSide: true,
  createdAt: true,
  players: { select: { side: true, playerId: true } },
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

const fetchRatingMatchRows = unstable_cache(
  async (matchType: MatchType): Promise<RatingMatchRow[]> => {
    const rows = await prisma.match.findMany({
      where: { status: "COMPLETED", winnerSide: { not: null }, matchType },
      select: matchSelect,
    });
    return rows.map((row) => ({
      id: row.id,
      tournamentId: row.tournamentId,
      // Epoch ms, not Date - see the RatingMatchRow doc comment in engine.ts:
      // Date objects don't survive unstable_cache's JSON round-trip on a cache hit.
      tournamentStartDate: new Date(row.tournament.startDate).getTime(),
      // `winnerSide: { not: null }` in the query guarantees this, TS just can't see it.
      winnerSide: row.winnerSide as "A" | "B",
      createdAt: new Date(row.createdAt).getTime(),
      players: row.players,
      sets: row.sets,
    }));
  },
  ["rating-match-rows"],
  CACHE_OPTIONS,
);

export async function getSinglesRatings(): Promise<SinglesRatingRow[]> {
  const rows = await fetchRatingMatchRows("SINGLES");
  return [...computeSinglesRatings(rows).values()].sort(
    (a, b) => conservativeRating(b.rating) - conservativeRating(a.rating),
  );
}

export async function getDoublesRatings(): Promise<DoublesRatingRow[]> {
  const rows = await fetchRatingMatchRows("DOUBLES");
  return [...computeDoublesRatings(rows).values()].sort(
    (a, b) => conservativeOrdinal(b.rating) - conservativeOrdinal(a.rating),
  );
}
