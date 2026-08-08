import type { Glicko2Rating } from "./glicko2";
import { winProbability as glickoWinProbability } from "./glicko2";
import type { OpenSkillRating } from "./openskill";
import { winProbabilities as openskillWinProbabilities } from "./openskill";

/** Display-ready SET.club points, same number /rating's "Загальний" pill and the rating card's SET.club badge show. */
export type PlayerPointsDisplay = { points: number };

export type MatchPreview = {
  probA: number;
  probB: number;
  /** Every player in the match, keyed by id, so the match card can show each player's own current SET.club points next to their name - omitted for a player with no points in the current rolling window even though they still have a Glicko-2/OpenSkill rating feeding probA/probB below. */
  pointsByPlayerId: Record<string, PlayerPointsDisplay>;
};

type PreviewMatchInput = {
  matchType: "SINGLES" | "DOUBLES";
  players: { side: "A" | "B"; playerId: string }[];
};

/**
 * Win-probability preview for a not-yet-played match, from each side's
 * current rating (Glicko-2 for singles, OpenSkill for doubles) - the only
 * two models here with an actual win-probability formula, so this keeps
 * using them even though the *displayed* number next to each player is now
 * SET.club points (see pointsByPlayerId) - SET.club's placement-points
 * ladder has no probability model of its own. Returns null when either side
 * is empty or has a player with no rating yet (no completed matches of this
 * format) - there's nothing to predict from.
 */
export function buildMatchPreview(
  match: PreviewMatchInput,
  singlesRatingById: Map<string, Glicko2Rating>,
  doublesRatingById: Map<string, OpenSkillRating>,
  singlesPointsById: Map<string, number>,
  doublesPointsById: Map<string, number>,
): MatchPreview | null {
  const sideAIds = match.players.filter((p) => p.side === "A").map((p) => p.playerId);
  const sideBIds = match.players.filter((p) => p.side === "B").map((p) => p.playerId);
  if (sideAIds.length === 0 || sideBIds.length === 0) return null;

  const pointsById = match.matchType === "SINGLES" ? singlesPointsById : doublesPointsById;
  const buildPointsByPlayerId = (playerIds: string[]): Record<string, PlayerPointsDisplay> =>
    Object.fromEntries(
      playerIds.flatMap((id) => {
        const points = pointsById.get(id);
        return points != null ? [[id, { points }]] : [];
      }),
    );

  if (match.matchType === "SINGLES") {
    const a = singlesRatingById.get(sideAIds[0]);
    const b = singlesRatingById.get(sideBIds[0]);
    if (!a || !b) return null;
    const probA = glickoWinProbability(a, b);
    return {
      probA,
      probB: 1 - probA,
      pointsByPlayerId: buildPointsByPlayerId([sideAIds[0], sideBIds[0]]),
    };
  }

  const teamA = sideAIds.map((id) => doublesRatingById.get(id));
  const teamB = sideBIds.map((id) => doublesRatingById.get(id));
  if (teamA.some((r) => !r) || teamB.some((r) => !r)) return null;
  const [probA, probB] = openskillWinProbabilities(
    teamA as OpenSkillRating[],
    teamB as OpenSkillRating[],
  );

  return { probA, probB, pointsByPlayerId: buildPointsByPlayerId([...sideAIds, ...sideBIds]) };
}
