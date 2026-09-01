import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { CommitResult, DoublesDrawState, NamedMatchup } from './types';

function useInvalidateAfterRandomize(tournamentId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  };
}

/** POST /api/v1/tournaments/[id]/randomize/round-robin - commitSinglesRoundRobinAction (SINGLES tournaments, ALL or SEEDED_SPLIT strategy - no draw-preview step, unlike CUSTOM_GROUPS). */
export function useCommitSinglesRoundRobin(tournamentId: string) {
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({ strategy, acknowledgedCompletedLoss = false }: { strategy: 'ALL' | 'SEEDED_SPLIT'; acknowledgedCompletedLoss?: boolean }) =>
      apiRequest<CommitResult>(`/api/v1/tournaments/${tournamentId}/randomize/round-robin`, {
        method: 'POST',
        body: { strategy, acknowledgedCompletedLoss },
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST /api/v1/tournaments/[id]/randomize/doubles/draw-teams - drawDoublesTeamsAction (DOUBLES tournaments, read-only preview). */
export function useDrawDoublesTeams(tournamentId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<DoublesDrawState>(`/api/v1/tournaments/${tournamentId}/randomize/doubles/draw-teams`, {
        method: 'POST',
        body: {},
      }),
  });
}

/** POST /api/v1/tournaments/[id]/randomize/doubles/commit-teams - commitDoublesMatchesAction, persists a draw previously returned by useDrawDoublesTeams. */
export function useCommitDoublesTeams(tournamentId: string) {
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({ matchups, acknowledgedCompletedLoss = false }: { matchups: NamedMatchup[]; acknowledgedCompletedLoss?: boolean }) =>
      apiRequest<CommitResult>(`/api/v1/tournaments/${tournamentId}/randomize/doubles/commit-teams`, {
        method: 'POST',
        body: {
          matchups: matchups.map((m) => ({ sideAIds: m.sideA.playerIds, sideBIds: m.sideB.playerIds })),
          acknowledgedCompletedLoss,
        },
      }),
    onSuccess: () => invalidate(),
  });
}
