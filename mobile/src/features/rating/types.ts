import type { Glicko2Rating, OpenSkillRating } from '@/lib/rating-math';

export type SinglesRatingRow = { playerId: string; rating: Glicko2Rating; matchesPlayed: number };
export type DoublesRatingRow = { playerId: string; rating: OpenSkillRating; matchesPlayed: number };

/** Mirrors GET /api/v1/{rating,padel/rating} (src/app/api/v1/rating/route.ts). */
export type RatingResponse = {
  season: number | 'rolling';
  singles: { ratings: SinglesRatingRow[]; trend: Record<string, number> };
  doubles: { ratings: DoublesRatingRow[]; trend: Record<string, number> };
};
