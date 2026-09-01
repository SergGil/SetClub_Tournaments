export type MatchType = 'SINGLES' | 'DOUBLES';
export type MatchStatus = 'SCHEDULED' | 'COMPLETED';
export type Side = 'A' | 'B';

export type MatchPlayer = {
  side: Side;
  playerId: string;
  player: { id: string; name: string; nickname: string | null };
};

export type MatchSet = {
  setNumber: number;
  sideAGames: number;
  sideBGames: number;
  tiebreakSideAPoints: number | null;
  tiebreakSideBPoints: number | null;
};

/** Mirrors matchWithDetailsInclude (src/lib/queries/matches.ts). */
export type Match = {
  id: string;
  tournamentId: string;
  tournament: { id: string; name: string };
  matchType: MatchType;
  round: string | null;
  scheduledDate: string | null;
  status: MatchStatus;
  winnerSide: Side | null;
  retired: boolean;
  completedAt: string | null;
  updatedAt: string;
  players: MatchPlayer[];
  sets: MatchSet[];
};

/** matchFormSchema's shape (src/lib/validation/match.ts). */
export type MatchFormInput = {
  tournamentId: string;
  matchType: MatchType;
  round: string;
  scheduledDate: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
};

export type SetScoreInput = {
  sideAGames: number;
  sideBGames: number;
  tiebreakSideAPoints?: number | null;
  tiebreakSideBPoints?: number | null;
};

/** scoreFormSchema's shape. */
export type ScoreFormInput = {
  matchId: string;
  expectedUpdatedAt: string;
  retired: boolean;
  retiredWinnerSide: Side | null;
  sets: SetScoreInput[];
};

export type CascadeReset = { matchId: string; round: string; sideALabel: string; sideBLabel: string };
