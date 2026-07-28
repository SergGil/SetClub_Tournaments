import type { MatchType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { MatchPlayerRow, PlayerStats } from "@/lib/player-stats";
import { summarizePlayerStats } from "@/lib/player-stats";

export type { PlayerStats };

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

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const rows = await prisma.matchPlayer.findMany({
    where: { playerId, match: { status: "COMPLETED", winnerSide: { not: null } } },
    select: {
      side: true,
      match: { select: { winnerSide: true, sets: { select: { sideAGames: true, sideBGames: true } } } },
    },
  });
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

/** Stats for every player who has at least one completed match, keyed by playerId. */
export async function getAllPlayerStats(
  matchType?: MatchType,
  year?: number,
): Promise<Map<string, PlayerStats>> {
  const rows = await prisma.matchPlayer.findMany({
    where: {
      match: {
        status: "COMPLETED",
        winnerSide: { not: null },
        matchType,
        ...(year ? yearRangeFilter(year) : {}),
      },
    },
    select: {
      playerId: true,
      side: true,
      match: { select: { winnerSide: true, sets: { select: { sideAGames: true, sideBGames: true } } } },
    },
  });
  return groupByPlayer(rows);
}

/** Distinct calendar years that have at least one completed match, newest first. */
export async function getResultYears(): Promise<number[]> {
  const matches = await prisma.match.findMany({
    where: { status: "COMPLETED", winnerSide: { not: null } },
    select: { scheduledDate: true, createdAt: true },
  });
  const years = new Set<number>();
  for (const match of matches) {
    years.add((match.scheduledDate ?? match.createdAt).getUTCFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** Standings scoped to a single tournament's completed matches, keyed by playerId. */
export async function getTournamentStandings(tournamentId: string): Promise<Map<string, PlayerStats>> {
  const rows = await prisma.matchPlayer.findMany({
    where: { match: { tournamentId, status: "COMPLETED", winnerSide: { not: null } } },
    select: {
      playerId: true,
      side: true,
      match: { select: { winnerSide: true, sets: { select: { sideAGames: true, sideBGames: true } } } },
    },
  });
  return groupByPlayer(rows);
}
