import type { Match } from '@/features/matches/types';

/** Mirrors getTournamentTeams (src/lib/queries/tournament-teams.ts). */
export type Team = {
  id: string;
  name: string;
  members: { id: string; name: string; nickname: string | null }[];
};

/** Mirrors TournamentTieWithRubbers (src/lib/tournament-ties.ts). */
export type Tie = {
  id: string;
  label: string | null;
  teamA: Team;
  teamB: Team;
  rubbers: Match[];
};

export type StandingsRow = {
  key: string;
  label: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
};

/** Mirrors GET /api/v1/tournaments/[id]/ties's response (getTeamTieStandings). */
export type TieStandings = { rows: StandingsRow[]; roundRobinDone: boolean; ties: Tie[] };
