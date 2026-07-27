import type { MatchSide } from "@/generated/prisma/enums";

export type PlayerStats = {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
};

export type MatchPlayerRow = {
  side: MatchSide;
  match: { winnerSide: MatchSide | null };
};

export function summarizePlayerStats(playerId: string, rows: MatchPlayerRow[]): PlayerStats {
  const matchesPlayed = rows.length;
  const wins = rows.filter((row) => row.match.winnerSide === row.side).length;
  const losses = matchesPlayed - wins;
  const winPct = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  return { playerId, matchesPlayed, wins, losses, winPct };
}
