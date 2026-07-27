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

/** Stats for every player who has at least one completed match, keyed by playerId. */
export async function getAllPlayerStats(matchType?: MatchType): Promise<Map<string, PlayerStats>> {
  const rows = await prisma.matchPlayer.findMany({
    where: { match: { status: "COMPLETED", winnerSide: { not: null }, matchType } },
    select: {
      playerId: true,
      side: true,
      match: { select: { winnerSide: true, sets: { select: { sideAGames: true, sideBGames: true } } } },
    },
  });
  return groupByPlayer(rows);
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
