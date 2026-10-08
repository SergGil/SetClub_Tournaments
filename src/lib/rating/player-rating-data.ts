import type { DoublesRatingRow, SinglesRatingRow } from "./engine";
import { buildDoublesRatingCard, buildSinglesRatingCard } from "./player-rating-cards";
import type { RatingCardData } from "./player-rating-cards";
import type { SetClubPointsRow } from "./placement";
import type { RatingHistoryPoint } from "./ratings-data";

/**
 * Everything a profile page's "Рейтинг клубу" block needs for ONE sport/pool, built from the
 * raw lists each sport's data file returns (the Tennis profile feeds it getSinglesRatings & co,
 * the Padel one getPadelSinglesRatings & co - those fetches stay in the pages, since the
 * function names differ). One shared builder keeps the card/rank-map logic identical for both
 * sports and both pools.
 */
export type PlayerRatingSource = {
  singlesRatings: SinglesRatingRow[];
  doublesRatings: DoublesRatingRow[];
  singlesHistory: RatingHistoryPoint[];
  doublesHistory: RatingHistoryPoint[];
  singlesSetClubPoints: SetClubPointsRow[];
  doublesSetClubPoints: SetClubPointsRow[];
  singlesRatingsTrend: Map<string, number>;
  doublesRatingsTrend: Map<string, number>;
  singlesSetClubTrend: Map<string, number>;
  doublesSetClubTrend: Map<string, number>;
};

export type PlayerRatingSection = {
  singlesCard: RatingCardData | null;
  doublesCard: RatingCardData | null;
  singlesHistory: RatingHistoryPoint[];
  doublesHistory: RatingHistoryPoint[];
  /** Match cards show SET.club rank, not the Glicko-2/OpenSkill number on the rating cards. */
  singlesRankById: Record<string, number>;
  doublesRankById: Record<string, number>;
};

export function buildPlayerRatingSection(playerId: string, source: PlayerRatingSource): PlayerRatingSection {
  return {
    singlesCard: buildSinglesRatingCard(
      playerId,
      source.singlesRatings,
      source.singlesRatingsTrend,
      source.singlesSetClubPoints,
      source.singlesSetClubTrend,
    ),
    doublesCard: buildDoublesRatingCard(
      playerId,
      source.doublesRatings,
      source.doublesRatingsTrend,
      source.doublesSetClubPoints,
      source.doublesSetClubTrend,
    ),
    singlesHistory: source.singlesHistory,
    doublesHistory: source.doublesHistory,
    singlesRankById: Object.fromEntries(source.singlesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
    doublesRankById: Object.fromEntries(source.doublesSetClubPoints.map((r, i) => [r.playerId, i + 1])),
  };
}

/** For a pool the player has no matches in (e.g. the women's pool for a player who never played a women's tournament) - renders nothing and ranks nobody. */
export const EMPTY_PLAYER_RATING_SECTION: PlayerRatingSection = {
  singlesCard: null,
  doublesCard: null,
  singlesHistory: [],
  doublesHistory: [],
  singlesRankById: {},
  doublesRankById: {},
};
