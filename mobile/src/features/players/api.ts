import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { Achievement, Player, PlayerFormInput } from './types';

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

/**
 * Mirrors GET /api/v1/players/me - the signed-in user's own linked Player
 * (null if this account has none), used to point the profile tab's avatar
 * at "my own achievements" the same way web's nav header avatar links to
 * `/players/[id]` (see IdentityLink in src/components/nav.tsx).
 *
 * `userId` (not just a boolean) is part of the query key on purpose: this
 * app never clears the react-query cache on sign-out (no queryClient.clear()
 * in auth-context.tsx), so a bare `['players', 'me']` key would let User B
 * see User A's still-fresh cached player on a shared/demo device if B signs
 * in within the 60s staleTime of A signing out. Keying by userId makes a
 * different account a cache miss instead of a stale hit - caller passes
 * `session?.user.id`, which doubles as the enabled condition.
 */
export function useMyPlayer(userId: string | undefined) {
  return useQuery({
    queryKey: ['players', 'me', userId],
    queryFn: () => apiRequest<{ player: { id: string; name: string } | null }>('/api/v1/players/me'),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/** Mirrors GET /api/v1/players/[id]/achievements - see docs/ACHIEVEMENTS.md. */
export function useAchievements(playerId: string) {
  return useQuery({
    queryKey: ['players', playerId, 'achievements'],
    queryFn: () => apiRequest<{ achievements: Achievement[] }>(`/api/v1/players/${playerId}/achievements`),
    enabled: Boolean(playerId),
    staleTime: 60_000,
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
