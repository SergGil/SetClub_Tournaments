import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { RatingHistoryResponse, RatingResponse } from './types';

/** Mirrors GET /api/v1/rating and its padel twin. */
export function useRating(sport: 'tennis' | 'padel') {
  const path = sport === 'tennis' ? '/api/v1/rating' : '/api/v1/padel/rating';
  return useQuery({
    queryKey: ['rating', sport],
    queryFn: () => apiRequest<RatingResponse>(path),
    staleTime: 60_000,
  });
}

/** Mirrors GET /api/v1/players/[id]/rating-history - one player's rating-over-time history, oldest first. */
export function useRatingHistory(playerId: string, sport: 'tennis' | 'padel', format: 'singles' | 'doubles') {
  const matchType = format === 'singles' ? 'SINGLES' : 'DOUBLES';
  return useQuery({
    queryKey: ['rating-history', sport, matchType, playerId],
    queryFn: () =>
      apiRequest<RatingHistoryResponse>(`/api/v1/players/${playerId}/rating-history?matchType=${matchType}&sport=${sport}`),
    enabled: Boolean(playerId),
    staleTime: 60_000,
  });
}
