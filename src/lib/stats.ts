import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { MatchPlayerRow, PlayerStats } from "@/lib/player-stats";
import { summarizePlayerStats } from "@/lib/player-stats";

export type { PlayerStats };

/**
 * Tag for every cached query below. Match-mutating server actions call
 * revalidateTag(STATS_CACHE_TAG) so stats update immediately once a score
 * changes; the 60s revalidate is just a safety net in case a mutation path
 * is ever missed. Only the raw Prisma rows are cached (plain, JSON-serializable
 * data) - the Map aggregation stays outside the cache boundary since Maps
 * aren't safe to serialize through Next's cache.
 */
export const STATS_CACHE_TAG = "match-stats";
const CACHE_OPTIONS = { tags: [STATS_CACHE_TAG], revalidate: 60 };

function groupByPlayer(
  rows: (MatchPlayerRow & { playerId: string })[],
): Map<string, PlayerStats> {
  const grouped = new Map<string, MatchPlayerRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.playerId);
    if (list) list.push(row);
    else grouped.set(row.playerId, [row]);
  }

  const result = new Map<string, PlayerStats>();
  for (const [playerId, list] of grouped) {
    result.set(playerId, summarizePlayerStats(playerId, list));
  }
  return result;
}

const matchSelect = {
  winnerSide: true,
  tournamentId: true,
  sets: { select: { sideAGames: true, sideBGames: true } },
} as const;

const fetchPlayerMatchRows = unstable_cache(
  (playerId: string) =>
    prisma.matchPlayer.findMany({
      where: { playerId, match: { status: "COMPLETED", winnerSide: { not: null } } },
      select: { side: true, match: { select: matchSelect } },
    }),
  ["player-match-rows"],
  CACHE_OPTIONS,
);

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const rows = await fetchPlayerMatchRows(playerId);
  return summarizePlayerStats(playerId, rows);
}

/** Matches a completed match to a year, preferring the scheduled date and falling back to when it was recorded. */
function yearRangeFilter(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return {
    OR: [
      { scheduledDate: { gte: start, lt: end } },
      { scheduledDate: null, createdAt: { gte: start, lt: end } },
    ],
  };
}

const fetchAllPlayerMatchRows = unstable_cache(
  (matchType: MatchType | undefined, year: number | undefined) =>
    prisma.matchPlayer.findMany({
      where: {
        match: {
          status: "COMPLETED",
          winnerSide: { not: null },
          matchType,
          ...(year ? yearRangeFilter(year) : {}),
        },
      },
      select: { playerId: true, side: true, match: { select: matchSelect } },
    }),
  ["all-player-match-rows"],
  CACHE_OPTIONS,
);

/** Stats for every player who has at least one completed match, keyed by playerId. */
export async function getAllPlayerStats(
  matchType?: MatchType,
  year?: number,
): Promise<Map<string, PlayerStats>> {
  const rows = await fetchAllPlayerMatchRows(matchType, year);
  return groupByPlayer(rows);
}

/** Distinct calendar years that have at least one completed match, newest first. */
export const getResultYears = unstable_cache(
  async (): Promise<number[]> => {
    const matches = await prisma.match.findMany({
      where: { status: "COMPLETED", winnerSide: { not: null } },
      select: { scheduledDate: true, createdAt: true },
    });
    const years = new Set<number>();
    for (const match of matches) {
      years.add((match.scheduledDate ?? match.createdAt).getUTCFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  },
  ["result-years"],
  CACHE_OPTIONS,
);

const fetchTournamentMatchRows = unstable_cache(
  (tournamentId: string) =>
    prisma.matchPlayer.findMany({
      where: { match: { tournamentId, status: "COMPLETED", winnerSide: { not: null } } },
      select: { playerId: true, side: true, match: { select: matchSelect } },
    }),
  ["tournament-match-rows"],
  CACHE_OPTIONS,
);

/** Standings scoped to a single tournament's completed matches, keyed by playerId. */
export async function getTournamentStandings(tournamentId: string): Promise<Map<string, PlayerStats>> {
  const rows = await fetchTournamentMatchRows(tournamentId);
  return groupByPlayer(rows);
}
