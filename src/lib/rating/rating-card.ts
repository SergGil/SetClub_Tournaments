import type { DoublesRatingRow, SinglesRatingRow } from "@/lib/rating/engine";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";

export type RatingCard = { rating: number; spread: number; matchesPlayed: number };

/**
 * Display-ready {rating, spread, matchesPlayed} from a raw engine row - same
 * rounding /rating (and /padel/rating) use for their table cells. Shared by
 * /rating/compare and /padel/rating/compare (docs/DESIGN_ROADMAP_2026.md #6):
 * SinglesRatingRow/DoublesRatingRow from engine.ts are reused as-is by the
 * Padel rating pipeline (see padel-ratings-data.ts), so this needs no
 * Padel-specific twin.
 */
export function singlesRatingCard(row: SinglesRatingRow): RatingCard {
  return {
    rating: Math.round(conservativeRating(row.rating)),
    spread: Math.round(row.rating.rd),
    matchesPlayed: row.matchesPlayed,
  };
}

export function doublesRatingCard(row: DoublesRatingRow): RatingCard {
  return {
    rating: Math.round(conservativeOrdinal(row.rating)),
    spread: Math.round(displaySpread(row.rating.sigma)),
    matchesPlayed: row.matchesPlayed,
  };
}
