import type { MatchSide } from "@/generated/prisma/enums";

import { resultForSide } from "./match-result";

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
    /** Technical loss from withdrawParticipantAction - see the schema comment on Match.walkover. */
    walkover: boolean;
  };
};

export function summarizePlayerStats(playerId: string, rows: MatchPlayerRow[]): PlayerStats {
  // A row whose match has no winnerSide yet (not COMPLETED) is undecided -
  // excluded entirely rather than falling through to "loss" below, since
  // it's neither a win nor a loss. A walkover match's LOSING side is
  // excluded too - the withdrawn player must not take a personal loss for a
  // match they never played (see docs/WITHDRAWAL.md) - the winning side's
  // row stays and counts as a normal win. See resultForSide (match-result.ts).
  const decidedRows = rows.filter(
    (row) => resultForSide(row.match.winnerSide, row.side, row.match.walkover) !== null,
  );
  const matchesPlayed = decidedRows.length;
  const wins = decidedRows.filter((row) => row.match.winnerSide === row.side).length;
  const losses = matchesPlayed - wins;
  const winPct = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  const tournamentsPlayed = new Set(decidedRows.map((row) => row.match.tournamentId)).size;

  let gamesWon = 0;
  let gamesLost = 0;
  for (const row of decidedRows) {
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
