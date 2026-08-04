import type { Glicko2Rating } from "./glicko2";
import { conservativeRating, winProbability as glickoWinProbability } from "./glicko2";
import type { OpenSkillRating } from "./openskill";
import { conservativeOrdinal, displaySpread, winProbabilities as openskillWinProbabilities } from "./openskill";

/** Display-ready rating (already rounded), same numbers /rating and the rating card show. */
export type PlayerRatingDisplay = { rating: number; spread: number };

export type MatchPreview = {
  probA: number;
  probB: number;
  /** Every player in the match, keyed by id, so the match card can show each player's own current rating next to their name. */
  ratingByPlayerId: Record<string, PlayerRatingDisplay>;
};

type PreviewMatchInput = {
  matchType: "SINGLES" | "DOUBLES";
  players: { side: "A" | "B"; playerId: string }[];
};

/**
 * Win-probability preview for a not-yet-played match, from each side's
 * current rating (Glicko-2 for singles, OpenSkill for doubles). Returns null
 * when either side is empty or has a player with no rating yet (no completed
 * matches of this format) - there's nothing to predict from.
 */
export function buildMatchPreview(
  match: PreviewMatchInput,
  singlesRatingById: Map<string, Glicko2Rating>,
  doublesRatingById: Map<string, OpenSkillRating>,
): MatchPreview | null {
  const sideAIds = match.players.filter((p) => p.side === "A").map((p) => p.playerId);
  const sideBIds = match.players.filter((p) => p.side === "B").map((p) => p.playerId);
  if (sideAIds.length === 0 || sideBIds.length === 0) return null;

  if (match.matchType === "SINGLES") {
    const a = singlesRatingById.get(sideAIds[0]);
    const b = singlesRatingById.get(sideBIds[0]);
    if (!a || !b) return null;
    const probA = glickoWinProbability(a, b);
    return {
      probA,
      probB: 1 - probA,
      ratingByPlayerId: {
        [sideAIds[0]]: { rating: Math.round(conservativeRating(a)), spread: Math.round(a.rd) },
        [sideBIds[0]]: { rating: Math.round(conservativeRating(b)), spread: Math.round(b.rd) },
      },
    };
  }

  const teamA = sideAIds.map((id) => doublesRatingById.get(id));
  const teamB = sideBIds.map((id) => doublesRatingById.get(id));
  if (teamA.some((r) => !r) || teamB.some((r) => !r)) return null;
  const [probA, probB] = openskillWinProbabilities(
    teamA as OpenSkillRating[],
    teamB as OpenSkillRating[],
  );

  const ratingByPlayerId: Record<string, PlayerRatingDisplay> = {};
  sideAIds.forEach((id, i) => {
    const r = teamA[i] as OpenSkillRating;
    ratingByPlayerId[id] = { rating: Math.round(conservativeOrdinal(r)), spread: Math.round(displaySpread(r.sigma)) };
  });
  sideBIds.forEach((id, i) => {
    const r = teamB[i] as OpenSkillRating;
    ratingByPlayerId[id] = { rating: Math.round(conservativeOrdinal(r)), spread: Math.round(displaySpread(r.sigma)) };
  });

  return { probA, probB, ratingByPlayerId };
}
