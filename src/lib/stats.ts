import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { bucketByMonth, monthsBetween } from "@/lib/activity-trend";
import type { MonthlyCount } from "@/lib/activity-trend";
import { prisma } from "@/lib/db";
import type { MatchPlayerRow, PlayerStats } from "@/lib/player-stats";
import { summarizePlayerStats } from "@/lib/player-stats";

export type { PlayerStats };

/**
 * Tag for every cached query below. Match-mutating server actions call
 * updateTag(STATS_CACHE_TAG) so stats update immediately once a score
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
  walkover: true,
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

const h2hMatchSelect = {
  winnerSide: true,
  players: { select: { side: true, playerId: true } },
  walkover: true,
} as const;

const fetchHeadToHeadMatchRows = unstable_cache(
  (matchType: MatchType | undefined, year: number | undefined) =>
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        matchType,
        ...(year ? yearRangeFilter(year) : {}),
      },
      select: h2hMatchSelect,
    }),
  ["head-to-head-match-rows"],
  CACHE_OPTIONS,
);

export type HeadToHeadMatchRow = {
  winnerSide: "A" | "B";
  players: { side: "A" | "B"; playerId: string }[];
  walkover: boolean;
};

/** Raw completed+decided matches (player sides + winner) for building a club-wide pairwise head-to-head matrix - see src/lib/head-to-head.ts. */
export async function getHeadToHeadMatchRows(
  matchType?: MatchType,
  year?: number,
): Promise<HeadToHeadMatchRow[]> {
  const rows = await fetchHeadToHeadMatchRows(matchType, year);
  // `winnerSide: { not: null }` in the query guarantees this, TS just can't see it.
  return rows.map((row) => ({ ...row, winnerSide: row.winnerSide as "A" | "B" }));
}

const fetchMonthlyActivityRows = unstable_cache(
  async () => {
    const [matches, tournaments] = await Promise.all([
      prisma.match.findMany({
        where: { status: "COMPLETED", winnerSide: { not: null } },
        select: { completedAt: true, scheduledDate: true, createdAt: true },
      }),
      prisma.tournament.findMany({ select: { startDate: true } }),
    ]);
    return {
      // scheduledDate (the match's actual/intended play date) comes first,
      // not completedAt: historical results are often entered in a single
      // backfill session well after the fact (e.g. a May tournament's scores
      // all saved on August 3rd), which would otherwise pile every match
      // onto the data-entry month instead of the month it was actually
      // played. completedAt/createdAt are only a fallback for the rare match
      // with no scheduledDate at all.
      matchDates: matches.map((m) => (m.scheduledDate ?? m.completedAt ?? m.createdAt).toISOString()),
      tournamentDates: tournaments.map((t) => t.startDate.toISOString()),
    };
  },
  ["monthly-activity-rows"],
  CACHE_OPTIONS,
);

export type MonthlyActivity = {
  matches: MonthlyCount[];
  tournaments: MonthlyCount[];
};

/** Club-wide match/tournament counts per calendar month, for the activity trend on /leaderboard. */
export async function getMonthlyActivity(): Promise<MonthlyActivity> {
  const { matchDates, tournamentDates } = await fetchMonthlyActivityRows();
  const matches = matchDates.map((d) => new Date(d));
  const tournaments = tournamentDates.map((d) => new Date(d));
  const months = monthsBetween([matches, tournaments]);
  return {
    matches: bucketByMonth(matches, months),
    tournaments: bucketByMonth(tournaments, months),
  };
}

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
