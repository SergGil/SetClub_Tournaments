import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { Player, PlayerFormInput } from './types';

/** Mirrors GET /api/v1/players (src/app/api/v1/players/route.ts) - full roster, no query, for pickers like "add participant". */
export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: () => apiRequest<{ players: Player[] }>('/api/v1/players'),
    staleTime: 60_000,
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ['players', id],
    queryFn: () => apiRequest<{ player: Player }>(`/api/v1/players/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidatePlayers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['players'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['players', id] });
  };
}

type MutationResult = { success: true } | { error: string; fieldErrors?: Record<string, string> };

/** POST /api/v1/players - createPlayerCore. */
export function useCreatePlayer() {
  const invalidate = useInvalidatePlayers();
  return useMutation({
    mutationFn: (data: PlayerFormInput) =>
      apiRequest<MutationResult>('/api/v1/players', { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/players/[id] - updatePlayerCore. */
export function useUpdatePlayer(id: string) {
  const invalidate = useInvalidatePlayers();
  return useMutation({
    mutationFn: (data: PlayerFormInput) =>
      apiRequest<MutationResult>(`/api/v1/players/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/players/[id] - deletePlayerCore (blocked server-side if the player has match/tournament history). */
export function useDeletePlayer() {
  const invalidate = useInvalidatePlayers();
  return useMutation({
    mutationFn: (id: string) => apiRequest<MutationResult>(`/api/v1/players/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}
