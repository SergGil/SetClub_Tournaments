import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { useSport } from '@/lib/sport-context';

import type {
  CascadeReset,
  TournamentDetail,
  TournamentFormat,
  TournamentFormInput,
  TournamentListItem,
} from './types';

/** `/api/v1/tournaments` for tennis, `/api/v1/padel/tournaments` for padel - every hook below reads the active sport from SportContext, so screens don't have to pass it through. */
function useBasePath() {
  const { sport } = useSport();
  return sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
}

/** Mirrors GET /api/v1/tournaments (and its padel twin). */
export function useTournaments(query?: string, format?: TournamentFormat) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['tournaments', sport, { query, format }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (query) params.set('q', query);
      if (format) params.set('format', format);
      return apiRequest<{ tournaments: TournamentListItem[]; total: number }>(`${base}?${params.toString()}`);
    },
  });
}

/** Mirrors GET /api/v1/tournaments/[id]. */
export function useTournament(id: string) {
  const { sport } = useSport();
  const base = useBasePath();
  return useQuery({
    queryKey: ['tournaments', sport, id],
    queryFn: () => apiRequest<{ tournament: TournamentDetail }>(`${base}/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateTournaments() {
  const queryClient = useQueryClient();
  const { sport } = useSport();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['tournaments', sport] });
    if (id) queryClient.invalidateQueries({ queryKey: ['tournaments', sport, id] });
  };
}

/** POST /api/v1/tournaments - createTournamentCore (src/lib/actions/tournaments.ts, or its padel twin). */
export function useCreateTournament() {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (data: TournamentFormInput) =>
      apiRequest<{ tournament: { id: string } }>(base, { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/tournaments/[id] - updateTournamentCore. */
export function useUpdateTournament(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (data: TournamentFormInput) =>
      apiRequest<{ success: true }>(`${base}/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id] - deleteTournamentCore. `acknowledgedCompletedLoss` mirrors the web confirm-dialog gate for tournaments with recorded scores. */
export function useDeleteTournament(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (acknowledgedCompletedLoss: boolean = false) =>
      apiRequest<{ success: true }>(`${base}/${id}?acknowledgedCompletedLoss=${acknowledgedCompletedLoss}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST /api/v1/tournaments/[id]/reset - resetTournamentCore. */
export function useResetTournament(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (acknowledgedCompletedLoss: boolean = false) =>
      apiRequest<{ success: true }>(`${base}/${id}/reset`, {
        method: 'POST',
        body: { acknowledgedCompletedLoss },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** POST /api/v1/tournaments/[id]/participants - addParticipantAction. */
export function useAddParticipants(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (playerIds: string[]) =>
      apiRequest<{ success: true }>(`${base}/${id}/participants`, {
        method: 'POST',
        body: { playerIds },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id]/participants/[playerId] - removeParticipantAction. */
export function useRemoveParticipant(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (playerId: string) =>
      apiRequest<{ success: true }>(`${base}/${id}/participants/${playerId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(id),
  });
}

/** PATCH /api/v1/tournaments/[id]/participants/[playerId] - toggleParticipantSeedAction. */
export function useToggleParticipantSeed(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ playerId, seeded }: { playerId: string; seeded: boolean }) =>
      apiRequest<{ success: true }>(`${base}/${id}/participants/${playerId}`, {
        method: 'PATCH',
        body: { seeded },
      }),
    onSuccess: () => invalidate(id),
  });
}

type WithdrawResult = { success: true } | { error: string; cascadeResets?: CascadeReset[] };

/** POST /api/v1/tournaments/[id]/participants/[playerId]/withdraw - withdrawParticipantCore. */
export function useWithdrawParticipant(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ playerId, acknowledgedCascadeReset = false }: { playerId: string; acknowledgedCascadeReset?: boolean }) =>
      apiRequest<WithdrawResult>(`${base}/${id}/participants/${playerId}/withdraw`, {
        method: 'POST',
        body: { acknowledgedCascadeReset },
      }),
    onSuccess: () => invalidate(id),
  });
}

/** POST /api/v1/tournaments/[id]/groups - createTournamentGroupAction. */
export function useCreateGroup(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ name, playerIds }: { name: string; playerIds: string[] }) =>
      apiRequest<{ success: true }>(`${base}/${id}/groups`, { method: 'POST', body: { name, playerIds } }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/tournaments/[id]/groups/[groupId] - deleteTournamentGroupAction. */
export function useDeleteGroup(id: string) {
  const base = useBasePath();
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (groupId: string) =>
      apiRequest<{ success: true }>(`${base}/${id}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(id),
  });
}
