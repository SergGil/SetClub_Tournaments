import type { MatchSide } from "@/generated/prisma/enums";

export type PlayerStats = {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesWon: number;
  gamesLost: number;
  tournamentsPlayed: number;
};

export type MatchPlayerRow = {
  side: MatchSide;
  match: {
    winnerSide: MatchSide | null;
    sets: { sideAGames: number; sideBGames: number }[];
    tournamentId: string;
  };
};

export function summarizePlayerStats(playerId: string, rows: MatchPlayerRow[]): PlayerStats {
  const matchesPlayed = rows.length;
  const wins = rows.filter((row) => row.match.winnerSide === row.side).length;
  const losses = matchesPlayed - wins;
  const winPct = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  const tournamentsPlayed = new Set(rows.map((row) => row.match.tournamentId)).size;

  let gamesWon = 0;
  let gamesLost = 0;
  for (const row of rows) {
    for (const set of row.match.sets) {
      if (row.side === "A") {
        gamesWon += set.sideAGames;
        gamesLost += set.sideBGames;
      } else {
        gamesWon += set.sideBGames;
        gamesLost += set.sideAGames;
      }
    }
  }

  return { playerId, matchesPlayed, wins, losses, winPct, gamesWon, gamesLost, tournamentsPlayed };
}
