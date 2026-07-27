import type { MatchSide } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export type PlayerStats = {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
};

type MatchPlayerRow = {
  side: MatchSide;
  match: { winnerSide: MatchSide | null };
};

function summarize(playerId: string, rows: MatchPlayerRow[]): PlayerStats {
  const matchesPlayed = rows.length;
  const wins = rows.filter((row) => row.match.winnerSide === row.side).length;
  const losses = matchesPlayed - wins;
  const winPct = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  return { playerId, matchesPlayed, wins, losses, winPct };
}

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const rows = await prisma.matchPlayer.findMany({
    where: { playerId, match: { status: "COMPLETED", winnerSide: { not: null } } },
    select: { side: true, match: { select: { winnerSide: true } } },
  });
  return summarize(playerId, rows);
}

/** Stats for every player who has at least one completed match, keyed by playerId. */
export async function getAllPlayerStats(): Promise<Map<string, PlayerStats>> {
  const rows = await prisma.matchPlayer.findMany({
    where: { match: { status: "COMPLETED", winnerSide: { not: null } } },
    select: { playerId: true, side: true, match: { select: { winnerSide: true } } },
  });

  const grouped = new Map<string, MatchPlayerRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.playerId);
    if (list) list.push(row);
    else grouped.set(row.playerId, [row]);
  }

  const result = new Map<string, PlayerStats>();
  for (const [playerId, list] of grouped) {
    result.set(playerId, summarize(playerId, list));
  }
  return result;
}
