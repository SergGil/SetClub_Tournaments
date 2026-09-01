import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type {
  CascadeReset,
  TournamentDetail,
  TournamentFormat,
  TournamentFormInput,
  TournamentListItem,
} from './types';

const listKey = (query?: string, format?: TournamentFormat) => ['tournaments', { query, format }] as const;
const detailKey = (id: string) => ['tournaments', id] as const;

/** Mirrors GET /api/v1/tournaments (src/app/api/v1/tournaments/route.ts). */
export function useTournaments(query?: string, format?: TournamentFormat) {
  return useQuery({
    queryKey: listKey(query, format),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (query) params.set('q', query);
      if (format) params.set('format', format);
      return apiRequest<{ tournaments: TournamentListItem[]; total: number }>(
        `/api/v1/tournaments?${params.toString()}`,
      );
    },
  });
}

/** Mirrors GET /api/v1/tournaments/[id]. */
export function useTournament(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => apiRequest<{ tournament: TournamentDetail }>(`/api/v1/tournaments/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateTournaments() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    if (id) queryClient.invalidateQueries({ queryKey: detailKey(id) });
  };
}

/** POST /api/v1/tournaments - createTournamentCore (src/lib/actions/tournaments.ts). */
export function useCreateTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (data: TournamentFormInput) =>
      apiRequest<{ tournament: { id: string } }>('/api/v1/tournaments', { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/tournaments/[id] - updateTournamentCore. */
export function useUpdateTournament(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (data: TournamentFormInput) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id] - deleteTournamentCore. `acknowledgedCompletedLoss` mirrors the web confirm-dialog gate for tournaments with recorded scores. */
export function useDeleteTournament(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (acknowledgedCompletedLoss: boolean = false) =>
      apiRequest<{ success: true }>(
        `/api/v1/tournaments/${id}?acknowledgedCompletedLoss=${acknowledgedCompletedLoss}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => invalidate(),
  });
}

/** POST /api/v1/tournaments/[id]/reset - resetTournamentCore. */
export function useResetTournament(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (acknowledgedCompletedLoss: boolean = false) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/reset`, {
        method: 'POST',
        body: { acknowledgedCompletedLoss },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** POST /api/v1/tournaments/[id]/participants - addParticipantAction. */
export function useAddParticipants(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (playerIds: string[]) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/participants`, {
        method: 'POST',
        body: { playerIds },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id]/participants/[playerId] - removeParticipantAction. */
export function useRemoveParticipant(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/participants/${playerId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(id),
  });
}

/** PATCH /api/v1/tournaments/[id]/participants/[playerId] - toggleParticipantSeedAction. */
export function useToggleParticipantSeed(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ playerId, seeded }: { playerId: string; seeded: boolean }) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/participants/${playerId}`, {
        method: 'PATCH',
        body: { seeded },
      }),
    onSuccess: () => invalidate(id),
  });
}

type WithdrawResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** POST /api/v1/tournaments/[id]/participants/[playerId]/withdraw - withdrawParticipantCore. */
export function useWithdrawParticipant(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ playerId, acknowledgedCascadeReset = false }: { playerId: string; acknowledgedCascadeReset?: boolean }) =>
      apiRequest<WithdrawResult>(`/api/v1/tournaments/${id}/participants/${playerId}/withdraw`, {
        method: 'POST',
        body: { acknowledgedCascadeReset },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** POST /api/v1/tournaments/[id]/groups - createTournamentGroupAction. */
export function useCreateGroup(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ name, playerIds }: { name: string; playerIds: string[] }) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/groups`, { method: 'POST', body: { name, playerIds } }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id]/groups/[groupId] - deleteTournamentGroupAction. */
export function useDeleteGroup(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiRequest<{ success: true }>(`/api/v1/tournaments/${id}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(id),
  });
}
