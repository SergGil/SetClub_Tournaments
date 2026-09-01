import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { CascadeReset, Match, MatchFormInput, ScoreFormInput } from './types';

/** Mirrors GET /api/v1/matches - scoped to a tournament, a player, or (neither) the most recently played club-wide. */
export function useMatches(params: { tournamentId?: string; playerId?: string } = {}) {
  return useQuery({
    queryKey: ['matches', params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.tournamentId) search.set('tournamentId', params.tournamentId);
      if (params.playerId) search.set('playerId', params.playerId);
      if (!params.tournamentId && !params.playerId) search.set('limit', '30');
      return apiRequest<{ matches: Match[] }>(`/api/v1/matches?${search.toString()}`);
    },
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['matches', 'detail', id],
    queryFn: () => apiRequest<{ match: Match }>(`/api/v1/matches/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateMatches() {
  const queryClient = useQueryClient();
  return (id?: string, tournamentId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['matches', 'detail', id] });
    if (tournamentId) queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId] });
  };
}

/** POST /api/v1/matches - createMatchCore. */
export function useCreateMatch() {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: MatchFormInput) => apiRequest<{ success: true }>('/api/v1/matches', { method: 'POST', body: data }),
    onSuccess: (_result, variables) => invalidate(undefined, variables.tournamentId),
  });
}

/** PATCH /api/v1/matches/[id] - updateMatchCore. */
export function useUpdateMatch(id: string) {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: MatchFormInput) =>
      apiRequest<{ success: true; notice?: string }>(`/api/v1/matches/${id}`, { method: 'PATCH', body: data }),
    onSuccess: (_result, variables) => invalidate(id, variables.tournamentId),
  });
}

type DeleteResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** DELETE /api/v1/matches/[id] - deleteMatchCore. */
export function useDeleteMatch(id: string, tournamentId: string) {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (acknowledgedCascadeReset: boolean = false) =>
      apiRequest<DeleteResult>(`/api/v1/matches/${id}?acknowledgedCascadeReset=${acknowledgedCascadeReset}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(id, tournamentId),
  });
}

type ScoreResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** POST /api/v1/matches/[id]/score - saveScoreCore. `acknowledgedCascadeReset` is read from the raw body server-side, separately from scoreFormSchema (src/app/api/v1/matches/[id]/score/route.ts). */
export function useSaveScore(id: string, tournamentId: string) {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: ScoreFormInput & { acknowledgedCascadeReset?: boolean }) =>
      apiRequest<ScoreResult>(`/api/v1/matches/${id}/score`, { method: 'POST', body: data }),
    onSuccess: () => invalidate(id, tournamentId),
  });
}
