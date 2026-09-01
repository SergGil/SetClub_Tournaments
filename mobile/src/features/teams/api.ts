import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { useSport } from '@/lib/sport-context';

import type { Team, TieStandings } from './types';

/** `/api/v1/tournaments` for tennis, `/api/v1/padel/tournaments` for padel. */
function useBasePath() {
  const { sport } = useSport();
  return sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
}

/** GET /api/v1/tournaments/[id]/teams - getTournamentTeams, empty for a tournament that never opted into MIXED team play. */
export function useTeams(tournamentId: string) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['tournaments', sport, tournamentId, 'teams'],
    queryFn: () => apiRequest<{ teams: Team[] }>(`${base}/${tournamentId}/teams`),
    enabled: Boolean(tournamentId),
  });
}

/** GET /api/v1/tournaments/[id]/ties - getTeamTieStandings (ties with their rubbers, plus ranked team standings). */
export function useTies(tournamentId: string) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['tournaments', sport, tournamentId, 'ties'],
    queryFn: () => apiRequest<TieStandings>(`${base}/${tournamentId}/ties`),
    enabled: Boolean(tournamentId),
  });
}

function useInvalidateTeams(tournamentId: string) {
  const queryClient = useQueryClient();
  const { sport } = useSport();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tournaments', sport, tournamentId, 'teams'] });
    queryClient.invalidateQueries({ queryKey: ['tournaments', sport, tournamentId, 'ties'] });
  };
}

type Result = { success: true } | { error: string };

/** POST /api/v1/tournaments/[id]/teams - createTeamAction. */
export function useCreateTeam(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ name, memberPlayerIds }: { name: string; memberPlayerIds: string[] }) =>
      apiRequest<Result>(`${base}/${tournamentId}/teams`, { method: 'POST', body: { name, memberPlayerIds } }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/tournaments/[id]/teams/[teamId] - updateTeamAction. */
export function useUpdateTeam(tournamentId: string, teamId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ name, memberPlayerIds }: { name: string; memberPlayerIds: string[] }) =>
      apiRequest<Result>(`${base}/${tournamentId}/teams/${teamId}`, {
        method: 'PATCH',
        body: { name, memberPlayerIds },
      }),
    onSuccess: () => invalidate(),
  });
}

/** DELETE /api/v1/tournaments/[id]/teams/[teamId] - deleteTeamAction (blocked server-side while the team is still part of a tie). */
export function useDeleteTeam(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (teamId: string) => apiRequest<Result>(`${base}/${tournamentId}/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

/** POST /api/v1/tournaments/[id]/ties - createTieAction. */
export function useCreateTie(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ teamAId, teamBId, label }: { teamAId: string; teamBId: string; label: string }) =>
      apiRequest<Result>(`${base}/${tournamentId}/ties`, { method: 'POST', body: { teamAId, teamBId, label } }),
    onSuccess: () => invalidate(),
  });
}

/** DELETE /api/v1/tournaments/[id]/ties/[tieId] - deleteTieAction. */
export function useDeleteTie(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (tieId: string) => apiRequest<Result>(`${base}/${tournamentId}/ties/${tieId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

type RubberInput = {
  matchType: 'SINGLES' | 'DOUBLES';
  scheduledDate: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
};
type RubberResult = { success: true } | { error: string; fieldErrors?: Record<string, string> };

/** POST /api/v1/tournaments/[id]/ties/[tieId]/rubbers - createRubberCore (tieId comes from the URL, not the body). */
export function useCreateRubber(tournamentId: string, tieId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (data: RubberInput) =>
      apiRequest<RubberResult>(`${base}/${tournamentId}/ties/${tieId}/rubbers`, { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}
