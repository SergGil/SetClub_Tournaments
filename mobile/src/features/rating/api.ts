import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { RatingResponse } from './types';

/** Mirrors GET /api/v1/rating and its padel twin. */
export function useRating(sport: 'tennis' | 'padel') {
  const path = sport === 'tennis' ? '/api/v1/rating' : '/api/v1/padel/rating';
  return useQuery({
    queryKey: ['rating', sport],
    queryFn: () => apiRequest<RatingResponse>(path),
    staleTime: 60_000,
  });
}
