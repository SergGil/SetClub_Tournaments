export const TOURNAMENT_FORMATS = ['SINGLES', 'DOUBLES', 'MIXED'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const COURT_SURFACES = ['CLAY', 'GRASS', 'HARD'] as const;
export type CourtSurface = (typeof COURT_SURFACES)[number];

export const TOURNAMENT_FORMAT_LABEL: Record<TournamentFormat, string> = {
  SINGLES: 'Одиночний',
  DOUBLES: 'Парний',
  MIXED: 'Змішаний',
};

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  UPCOMING: 'Заплановано',
  ONGOING: 'Триває',
  COMPLETED: 'Завершено',
};

export const COURT_SURFACE_LABEL: Record<CourtSurface, string> = {
  CLAY: 'Ґрунт',
  GRASS: 'Трава',
  HARD: 'Хард',
};

/** Mirrors getTournamentsPage's TournamentListItem (src/lib/queries/tournaments.ts). */
export type TournamentListItem = {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  surface: CourtSurface;
  startDate: string;
  endDate: string;
  _count: { participants: number; matches: number };
};

export type TournamentParticipant = {
  tournamentId: string;
  playerId: string;
  seed: number | null;
  group: number | null;
  withdrawnAt: string | null;
  joinedAt: string;
  player: { id: string; name: string; nickname: string | null };
};

export type TournamentGroup = {
  id: string;
  tournamentId: string;
  number: number;
  name: string;
  members: { playerId: string }[];
};

/** Mirrors getTournamentById's include (src/lib/queries/tournaments.ts). */
export type TournamentDetail = TournamentListItem & {
  participants: TournamentParticipant[];
  groups: TournamentGroup[];
};

/** tournamentFormSchema's shape (src/lib/validation/tournament.ts) - what POST/PATCH /api/v1/tournaments expect. */
export type TournamentFormInput = {
  name: string;
  description: string;
  format: TournamentFormat;
  status: TournamentStatus;
  surface: CourtSurface;
  startDate: string;
  endDate: string;
};

export type CascadeReset = {
  matchId: string;
  round: string;
  sideALabel: string;
  sideBLabel: string;
};
