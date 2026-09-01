import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { useSport } from '@/lib/sport-context';

import type { CascadeReset, Match, MatchFormInput, ScoreFormInput } from './types';

/** `/api/v1/matches` for tennis, `/api/v1/padel/matches` for padel - reads the active sport from SportContext. */
function useBasePath() {
  const { sport } = useSport();
  return sport === 'tennis' ? '/api/v1/matches' : '/api/v1/padel/matches';
}

/** Mirrors GET /api/v1/matches - scoped to a tournament, a player, or (neither) the most recently played club-wide. */
export function useMatches(params: { tournamentId?: string; playerId?: string } = {}) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['matches', sport, params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.tournamentId) search.set('tournamentId', params.tournamentId);
      if (params.playerId) search.set('playerId', params.playerId);
      if (!params.tournamentId && !params.playerId) search.set('limit', '30');
      return apiRequest<{ matches: Match[] }>(`${base}?${search.toString()}`);
    },
  });
}

export function useMatch(id: string) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['matches', sport, 'detail', id],
    queryFn: () => apiRequest<{ match: Match }>(`${base}/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateMatches() {
  const queryClient = useQueryClient();
  const { sport } = useSport();
  // Broad ['tournaments'] invalidation (not scoped to this sport/id) since a
  // match write also changes that tournament's _count.matches and standings -
  // cheap enough at this club's data volume to just refetch whatever's mounted.
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['matches', sport] });
    if (id) queryClient.invalidateQueries({ queryKey: ['matches', sport, 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  };
}

/** POST /api/v1/matches - createMatchCore. */
export function useCreateMatch() {
  const base = useBasePath();
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: MatchFormInput) => apiRequest<{ success: true }>(base, { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/matches/[id] - updateMatchCore. */
export function useUpdateMatch(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: MatchFormInput) =>
      apiRequest<{ success: true; notice?: string }>(`${base}/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(id),
  });
}

type DeleteResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** DELETE /api/v1/matches/[id] - deleteMatchCore. */
export function useDeleteMatch(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (acknowledgedCascadeReset: boolean = false) =>
      apiRequest<DeleteResult>(`${base}/${id}?acknowledgedCascadeReset=${acknowledgedCascadeReset}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(id),
  });
}

type ScoreResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** POST /api/v1/matches/[id]/score - saveScoreCore. `acknowledgedCascadeReset` is read from the raw body server-side, separately from scoreFormSchema (src/app/api/v1/matches/[id]/score/route.ts). */
export function useSaveScore(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: (data: ScoreFormInput & { acknowledgedCascadeReset?: boolean }) =>
      apiRequest<ScoreResult>(`${base}/${id}/score`, { method: 'POST', body: data }),
    onSuccess: () => invalidate(id),
  });
}
