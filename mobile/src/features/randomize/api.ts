import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { useSport } from '@/lib/sport-context';

import type {
  CommitResult,
  DoublesDrawState,
  DoublesGroupDrawState,
  Groups12PlayoffDrawState,
  NamedGroupedMatchup,
  NamedMatchup,
  NamedSinglesMatchup,
  SinglesGroupDrawState,
} from './types';

/** `/api/v1/tournaments` for tennis, `/api/v1/padel/tournaments` for padel. */
function useBasePath() {
  const { sport } = useSport();
  return sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
}

function useInvalidateAfterRandomize(tournamentId: string) {
  const queryClient = useQueryClient();
  const { sport } = useSport();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tournaments', sport, tournamentId] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  };
}

/** POST .../randomize/round-robin - commitSinglesRoundRobinAction (SINGLES, ALL or SEEDED_SPLIT - no draw-preview step). */
export function useCommitSinglesRoundRobin(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({ strategy, acknowledgedCompletedLoss = false }: { strategy: 'ALL' | 'SEEDED_SPLIT'; acknowledgedCompletedLoss?: boolean }) =>
      apiRequest<CommitResult>(`${base}/${tournamentId}/randomize/round-robin`, {
        method: 'POST',
        body: { strategy, acknowledgedCompletedLoss },
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST .../randomize/groups/draw - drawSinglesGroupsAction (SINGLES CUSTOM_GROUPS, read-only preview - requires at least one participant already assigned a group in the roster). */
export function useDrawSinglesGroups(tournamentId: string) {
  const base = useBasePath();
  return useMutation({
    mutationFn: () => apiRequest<SinglesGroupDrawState>(`${base}/${tournamentId}/randomize/groups/draw`, { method: 'POST', body: {} }),
  });
}

/** POST .../randomize/groups/commit - commitSinglesGroupsAction, persists a draw from useDrawSinglesGroups. */
export function useCommitSinglesGroups(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({
      groupAssignment,
      matchups,
      acknowledgedCompletedLoss = false,
    }: {
      groupAssignment: Record<string, number>;
      matchups: NamedSinglesMatchup[];
      acknowledgedCompletedLoss?: boolean;
    }) =>
      apiRequest<CommitResult>(`${base}/${tournamentId}/randomize/groups/commit`, {
        method: 'POST',
        body: {
          groupAssignment,
          matchups: matchups.map((m) => ({ sideA: m.sideA.playerId, sideB: m.sideB.playerId, round: m.round })),
          acknowledgedCompletedLoss,
        },
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST .../randomize/groups12/draw - drawGroups12PlayoffAction (SINGLES GROUPS_12_PLAYOFF, requires exactly 12 participants with exactly 4 seeded). */
export function useDrawGroups12Playoff(tournamentId: string) {
  const base = useBasePath();
  return useMutation({
    mutationFn: () =>
      apiRequest<Groups12PlayoffDrawState>(`${base}/${tournamentId}/randomize/groups12/draw`, { method: 'POST', body: {} }),
  });
}

/** POST .../randomize/groups12/commit - commitGroups12PlayoffAction, persists a draw from useDrawGroups12Playoff. */
export function useCommitGroups12Playoff(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({
      groupAssignment,
      matchups,
      acknowledgedCompletedLoss = false,
    }: {
      groupAssignment: Record<string, number>;
      matchups: NamedSinglesMatchup[];
      acknowledgedCompletedLoss?: boolean;
    }) =>
      apiRequest<CommitResult>(`${base}/${tournamentId}/randomize/groups12/commit`, {
        method: 'POST',
        body: {
          groupAssignment,
          matchups: matchups.map((m) => ({ sideA: m.sideA.playerId, sideB: m.sideB.playerId, round: m.round })),
          acknowledgedCompletedLoss,
        },
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST .../randomize/doubles/draw-teams - drawDoublesTeamsAction (DOUBLES, plain round robin, read-only preview). */
export function useDrawDoublesTeams(tournamentId: string) {
  const base = useBasePath();
  return useMutation({
    mutationFn: () =>
      apiRequest<DoublesDrawState>(`${base}/${tournamentId}/randomize/doubles/draw-teams`, { method: 'POST', body: {} }),
  });
}

/** POST .../randomize/doubles/commit-teams - commitDoublesMatchesAction, persists a draw from useDrawDoublesTeams. */
export function useCommitDoublesTeams(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({ matchups, acknowledgedCompletedLoss = false }: { matchups: NamedMatchup[]; acknowledgedCompletedLoss?: boolean }) =>
      apiRequest<CommitResult>(`${base}/${tournamentId}/randomize/doubles/commit-teams`, {
        method: 'POST',
        body: {
          matchups: matchups.map((m) => ({ sideAIds: m.sideA.playerIds, sideBIds: m.sideB.playerIds })),
          acknowledgedCompletedLoss,
        },
      }),
    onSuccess: () => invalidate(),
  });
}

/** POST .../randomize/doubles/draw-groups - drawDoublesGroupsAction (DOUBLES "За групами", read-only preview). */
export function useDrawDoublesGroups(tournamentId: string) {
  const base = useBasePath();
  return useMutation({
    mutationFn: () =>
      apiRequest<DoublesGroupDrawState>(`${base}/${tournamentId}/randomize/doubles/draw-groups`, { method: 'POST', body: {} }),
  });
}

/** POST .../randomize/doubles/commit-groups - commitDoublesGroupsAction, persists a draw from useDrawDoublesGroups. */
export function useCommitDoublesGroups(tournamentId: string) {
  const base = useBasePath();
  const invalidate = useInvalidateAfterRandomize(tournamentId);
  return useMutation({
    mutationFn: ({
      groupAssignment,
      matchups,
      acknowledgedCompletedLoss = false,
    }: {
      groupAssignment: Record<string, number>;
      matchups: NamedGroupedMatchup[];
      acknowledgedCompletedLoss?: boolean;
    }) =>
      apiRequest<CommitResult>(`${base}/${tournamentId}/randomize/doubles/commit-groups`, {
        method: 'POST',
        body: {
          groupAssignment,
          matchups: matchups.map((m) => ({ sideAIds: m.sideA.playerIds, sideBIds: m.sideB.playerIds, group: m.group })),
          acknowledgedCompletedLoss,
        },
      }),
    onSuccess: () => invalidate(),
  });
}
