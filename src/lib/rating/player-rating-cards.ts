import type { DoublesRatingRow, SinglesRatingRow } from "@/lib/rating/engine";
import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import type { SetClubPointsRow } from "@/lib/rating/placement";
import { PROVISIONAL_MATCH_THRESHOLD } from "@/lib/rating/ratings-data";

/** One player's rating card data for a profile page - shared by the Tennis (/players/[id]) and Padel (/padel/players/[id]) profiles. */
export type RatingCardData = {
  rating: number;
  spread: number;
  rank: number | null;
  rankDelta: number | undefined;
  total: number;
  isProvisional: boolean;
  setClub: { points: number; rank: number; rankDelta: number | undefined; total: number } | null;
};

function buildSetClubCardData(
  playerId: string,
  setClubPoints: SetClubPointsRow[],
  setClubTrend: Map<string, number>,
): RatingCardData["setClub"] {
  const rank = setClubPoints.findIndex((row) => row.playerId === playerId);
  return rank >= 0
    ? {
        points: setClubPoints[rank].points,
        rank: rank + 1,
        rankDelta: setClubTrend.get(playerId),
        total: setClubPoints.length,
      }
    : null;
}

/** Same PROVISIONAL_MATCH_THRESHOLD split as /rating and /padel/rating - a player with too few completed matches gets a rank number nowhere in the app, instead of an oddly confident "# 7 з 15" contradicted by their own absence from the numbered table. */
export function buildSinglesRatingCard(
  playerId: string,
  ratings: SinglesRatingRow[],
  ratingsTrend: Map<string, number>,
  setClubPoints: SetClubPointsRow[],
  setClubTrend: Map<string, number>,
): RatingCardData | null {
  const rankRaw = ratings.findIndex((row) => row.playerId === playerId);
  if (rankRaw < 0) return null;
  const rankedRatings = ratings.filter((row) => row.matchesPlayed >= PROVISIONAL_MATCH_THRESHOLD);
  const rank = rankedRatings.findIndex((row) => row.playerId === playerId);
  const isProvisional = rank < 0;
  return {
    rating: Math.round(conservativeRating(ratings[rankRaw].rating)),
    spread: Math.round(ratings[rankRaw].rating.rd),
    rank: isProvisional ? null : rank + 1,
    rankDelta: ratingsTrend.get(playerId),
    total: rankedRatings.length,
    isProvisional,
    setClub: buildSetClubCardData(playerId, setClubPoints, setClubTrend),
  };
}

/** OpenSkill doubles equivalent of buildSinglesRatingCard. */
export function buildDoublesRatingCard(
  playerId: string,
  ratings: DoublesRatingRow[],
  ratingsTrend: Map<string, number>,
  setClubPoints: SetClubPointsRow[],
  setClubTrend: Map<string, number>,
): RatingCardData | null {
  const rankRaw = ratings.findIndex((row) => row.playerId === playerId);
  if (rankRaw < 0) return null;
  const rankedRatings = ratings.filter((row) => row.matchesPlayed >= PROVISIONAL_MATCH_THRESHOLD);
  const rank = rankedRatings.findIndex((row) => row.playerId === playerId);
  const isProvisional = rank < 0;
  return {
    rating: Math.round(conservativeOrdinal(ratings[rankRaw].rating)),
    spread: Math.round(displaySpread(ratings[rankRaw].rating.sigma)),
    rank: isProvisional ? null : rank + 1,
    rankDelta: ratingsTrend.get(playerId),
    total: rankedRatings.length,
    isProvisional,
    setClub: buildSetClubCardData(playerId, setClubPoints, setClubTrend),
  };
}
