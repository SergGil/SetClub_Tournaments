import { unstable_cache } from "next/cache";

import type { MatchType } from "@/generated/prisma/enums";
import { bucketByMonth, monthsBetween } from "@/lib/activity-trend";
import type { MonthlyCount } from "@/lib/activity-trend";
import { prisma } from "@/lib/db";
import type { MatchPlayerRow, PlayerStats } from "@/lib/player-stats";
import { summarizePlayerStats } from "@/lib/player-stats";

export type { PlayerStats };

/**
 * Tag for every cached Padel stats/rating query - Padel twin of
 * src/lib/stats.ts's STATS_CACHE_TAG. Match-mutating Padel actions call
 * updateTag(PADEL_STATS_CACHE_TAG) so stats update immediately once a score
 * changes.
 */
export const PADEL_STATS_CACHE_TAG = "padel-match-stats";
const CACHE_OPTIONS = { tags: [PADEL_STATS_CACHE_TAG], revalidate: 60 };

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

const fetchPadelPlayerMatchRows = unstable_cache(
  (playerId: string) =>
    prisma.padelMatchPlayer.findMany({
      where: { playerId, match: { status: "COMPLETED", winnerSide: { not: null } } },
      select: { side: true, match: { select: matchSelect } },
    }),
  ["padel-player-match-rows"],
  CACHE_OPTIONS,
);

/** Padel twin of getPlayerStats. */
export async function getPadelPlayerStats(playerId: string): Promise<PlayerStats> {
  const rows = await fetchPadelPlayerMatchRows(playerId);
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

const fetchAllPadelPlayerMatchRows = unstable_cache(
  (matchType: MatchType | undefined, year: number | undefined) =>
    prisma.padelMatchPlayer.findMany({
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
  ["all-padel-player-match-rows"],
  CACHE_OPTIONS,
);

/** Padel twin of getAllPlayerStats. */
export async function getAllPadelPlayerStats(
  matchType?: MatchType,
  year?: number,
): Promise<Map<string, PlayerStats>> {
  const rows = await fetchAllPadelPlayerMatchRows(matchType, year);
  return groupByPlayer(rows);
}

/** Padel twin of getResultYears. */
export const getPadelResultYears = unstable_cache(
  async (): Promise<number[]> => {
    const matches = await prisma.padelMatch.findMany({
      where: { status: "COMPLETED", winnerSide: { not: null } },
      select: { scheduledDate: true, createdAt: true },
    });
    const years = new Set<number>();
    for (const match of matches) {
      years.add((match.scheduledDate ?? match.createdAt).getUTCFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  },
  ["padel-result-years"],
  CACHE_OPTIONS,
);

const h2hMatchSelect = {
  winnerSide: true,
  players: { select: { side: true, playerId: true } },
  walkover: true,
} as const;

const fetchPadelHeadToHeadMatchRows = unstable_cache(
  (matchType: MatchType | undefined, year: number | undefined) =>
    prisma.padelMatch.findMany({
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        matchType,
        ...(year ? yearRangeFilter(year) : {}),
      },
      select: h2hMatchSelect,
    }),
  ["padel-head-to-head-match-rows"],
  CACHE_OPTIONS,
);

export type PadelHeadToHeadMatchRow = {
  winnerSide: "A" | "B";
  players: { side: "A" | "B"; playerId: string }[];
  walkover: boolean;
};

/** Padel twin of getHeadToHeadMatchRows - see src/lib/head-to-head.ts (reused as-is) for the matrix builder. */
export async function getPadelHeadToHeadMatchRows(
  matchType?: MatchType,
  year?: number,
): Promise<PadelHeadToHeadMatchRow[]> {
  const rows = await fetchPadelHeadToHeadMatchRows(matchType, year);
  return rows.map((row) => ({ ...row, winnerSide: row.winnerSide as "A" | "B" }));
}

const fetchPadelMonthlyActivityRows = unstable_cache(
  async () => {
    const [matches, tournaments] = await Promise.all([
      prisma.padelMatch.findMany({
        where: { status: "COMPLETED", winnerSide: { not: null } },
        select: { completedAt: true, scheduledDate: true, createdAt: true },
      }),
      prisma.padelTournament.findMany({ select: { startDate: true } }),
    ]);
    return {
      matchDates: matches.map((m) => (m.scheduledDate ?? m.completedAt ?? m.createdAt).toISOString()),
      tournamentDates: tournaments.map((t) => t.startDate.toISOString()),
    };
  },
  ["padel-monthly-activity-rows"],
  CACHE_OPTIONS,
);

export type PadelMonthlyActivity = {
  matches: MonthlyCount[];
  tournaments: MonthlyCount[];
};

/** Padel twin of getMonthlyActivity. */
export async function getPadelMonthlyActivity(): Promise<PadelMonthlyActivity> {
  const { matchDates, tournamentDates } = await fetchPadelMonthlyActivityRows();
  const matches = matchDates.map((d) => new Date(d));
  const tournaments = tournamentDates.map((d) => new Date(d));
  const months = monthsBetween([matches, tournaments]);
  return {
    matches: bucketByMonth(matches, months),
    tournaments: bucketByMonth(tournaments, months),
  };
}

const fetchPadelTournamentMatchRows = unstable_cache(
  (tournamentId: string) =>
    prisma.padelMatchPlayer.findMany({
      where: { match: { tournamentId, status: "COMPLETED", winnerSide: { not: null } } },
      select: { playerId: true, side: true, match: { select: matchSelect } },
    }),
  ["padel-tournament-match-rows"],
  CACHE_OPTIONS,
);

/** Padel twin of getTournamentStandings. */
export async function getPadelTournamentStandings(tournamentId: string): Promise<Map<string, PlayerStats>> {
  const rows = await fetchPadelTournamentMatchRows(tournamentId);
  return groupByPlayer(rows);
}
