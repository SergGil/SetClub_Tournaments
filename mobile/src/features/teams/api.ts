import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { Team, TieStandings } from './types';

/** GET /api/v1/tournaments/[id]/teams - getTournamentTeams, empty for a tournament that never opted into MIXED team play. */
export function useTeams(tournamentId: string) {
  return useQuery({
    queryKey: ['tournaments', tournamentId, 'teams'],
    queryFn: () => apiRequest<{ teams: Team[] }>(`/api/v1/tournaments/${tournamentId}/teams`),
    enabled: Boolean(tournamentId),
  });
}

/** GET /api/v1/tournaments/[id]/ties - getTeamTieStandings (ties with their rubbers, plus ranked team standings). */
export function useTies(tournamentId: string) {
  return useQuery({
    queryKey: ['tournaments', tournamentId, 'ties'],
    queryFn: () => apiRequest<TieStandings>(`/api/v1/tournaments/${tournamentId}/ties`),
    enabled: Boolean(tournamentId),
  });
}

function useInvalidateTeams(tournamentId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId, 'teams'] });
    queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId, 'ties'] });
  };
}

type Result = { success: true } | { error: string };

/** POST /api/v1/tournaments/[id]/teams - createTeamAction. */
export function useCreateTeam(tournamentId: string) {
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ name, memberPlayerIds }: { name: string; memberPlayerIds: string[] }) =>
      apiRequest<Result>(`/api/v1/tournaments/${tournamentId}/teams`, { method: 'POST', body: { name, memberPlayerIds } }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/tournaments/[id]/teams/[teamId] - updateTeamAction. */
export function useUpdateTeam(tournamentId: string, teamId: string) {
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ name, memberPlayerIds }: { name: string; memberPlayerIds: string[] }) =>
      apiRequest<Result>(`/api/v1/tournaments/${tournamentId}/teams/${teamId}`, {
        method: 'PATCH',
        body: { name, memberPlayerIds },
      }),
    onSuccess: () => invalidate(),
  });
}

/** DELETE /api/v1/tournaments/[id]/teams/[teamId] - deleteTeamAction (blocked server-side while the team is still part of a tie). */
export function useDeleteTeam(tournamentId: string) {
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (teamId: string) =>
      apiRequest<Result>(`/api/v1/tournaments/${tournamentId}/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

/** POST /api/v1/tournaments/[id]/ties - createTieAction. */
export function useCreateTie(tournamentId: string) {
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: ({ teamAId, teamBId, label }: { teamAId: string; teamBId: string; label: string }) =>
      apiRequest<Result>(`/api/v1/tournaments/${tournamentId}/ties`, { method: 'POST', body: { teamAId, teamBId, label } }),
    onSuccess: () => invalidate(),
  });
}

/** DELETE /api/v1/tournaments/[id]/ties/[tieId] - deleteTieAction. */
export function useDeleteTie(tournamentId: string) {
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (tieId: string) =>
      apiRequest<Result>(`/api/v1/tournaments/${tournamentId}/ties/${tieId}`, { method: 'DELETE' }),
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
  const invalidate = useInvalidateTeams(tournamentId);
  return useMutation({
    mutationFn: (data: RubberInput) =>
      apiRequest<RubberResult>(`/api/v1/tournaments/${tournamentId}/ties/${tieId}/rubbers`, { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}
