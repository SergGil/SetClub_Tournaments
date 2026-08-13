import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PADEL_STATS_CACHE_TAG } from "@/lib/padel-stats";

import type { RatingMatchRow } from "./engine";

// Padel twin of ratings-data.ts's fetchRatingMatchRows - reuses engine.ts's
// computeSinglesRatings/computeDoublesRatings as-is (pure functions over
// RatingMatchRow[], no Prisma coupling) so only the row-fetching needs a
// separate Padel implementation. The rest of ratings-data.ts (getSinglesRatings,
// trend variants, getSetClubSeasons, etc.) lands in the rating-engine
// milestone alongside the public /padel/rating page that reads them - this
// file only carries the raw row fetch, since it's what refreshPadelRatingSnapshots
// needs immediately for every mutating action to keep RatingSnapshot in sync.
const CACHE_OPTIONS = { tags: [PADEL_STATS_CACHE_TAG], revalidate: 60 };

const padelMatchSelect = {
  id: true,
  tournamentId: true,
  tournament: {
    select: {
      startDate: true,
      participants: { select: { playerId: true, seed: true } },
    },
  },
  winnerSide: true,
  createdAt: true,
  round: true,
  players: { select: { side: true, playerId: true } },
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

/** Exported for src/lib/rating/padel-snapshot.ts, which replays the same rows to rebuild PadelRatingSnapshot. */
export const fetchPadelRatingMatchRows = unstable_cache(
  async (matchType: MatchType): Promise<RatingMatchRow[]> => {
    const rows = await prisma.padelMatch.findMany({
      where: { status: "COMPLETED", winnerSide: { not: null }, matchType, walkover: false },
      select: padelMatchSelect,
    });
    return rows.map((row) => {
      const seededByPlayer = new Map(
        row.tournament.participants.map((p) => [p.playerId, p.seed !== null]),
      );
      return {
        id: row.id,
        tournamentId: row.tournamentId,
        tournamentStartDate: new Date(row.tournament.startDate).getTime(),
        winnerSide: row.winnerSide as "A" | "B",
        createdAt: new Date(row.createdAt).getTime(),
        round: row.round,
        tournamentParticipantCount: row.tournament.participants.length,
        players: row.players.map((p) => ({
          side: p.side,
          playerId: p.playerId,
          seeded: seededByPlayer.get(p.playerId) ?? false,
        })),
        sets: row.sets,
      };
    });
  },
  ["padel-rating-match-rows"],
  CACHE_OPTIONS,
);
