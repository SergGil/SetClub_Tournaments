import { ordinal, predictWin, rate, rating } from "openskill";

export type OpenSkillRating = { mu: number; sigma: number };

export const OPENSKILL_DEFAULT: OpenSkillRating = rating();

/**
 * OpenSkill's defaults (mu=25, sigma=25/3) live on a totally different scale
 * than Glicko-2's ~1500. Rescaled for *display only* - internal math always
 * stays in the library's native units - so a brand-new doubles player's
 * uncertainty band visually matches a brand-new singles player's: map
 * OpenSkill's default 1-sigma onto Glicko-2's default starting RD (350).
 */
const DISPLAY_SCALE = 350 / (25 / 3);

export function displayRating(mu: number): number {
  return 1500 + (mu - 25) * DISPLAY_SCALE;
}

/** Scales a raw sigma onto the same display units as displayRating (no offset - it's a spread, not a point). */
export function displaySpread(sigma: number): number {
  return sigma * DISPLAY_SCALE;
}

/**
 * The z=3 penalty (below) pulls a brand-new player's raw ordinal down to 0
 * (mu=25, sigma=25/3 -> 25-25=0) before displayRating's own baseline is
 * applied, so a first-time doubles player would otherwise display around
 * ~479 rather than the ~1500 a first-time singles player sees - and anyone
 * who has lost more than they've won can end up visibly negative. This
 * constant restores the intended ~1500 baseline for a new player without
 * touching mu/sigma, sort order, or rating deltas (adding the same constant
 * to every player cancels out of both a difference and a sort comparator).
 */
const CONSERVATIVE_DISPLAY_OFFSET = 1000;

/** displayRating(mu - 3*sigma) - OpenSkill's own conservative-leaderboard convention (Xbox Live TrueSkill) - plus CONSERVATIVE_DISPLAY_OFFSET. */
export function conservativeOrdinal(r: OpenSkillRating): number {
  return displayRating(ordinal(r, { z: 3 })) + CONSERVATIVE_DISPLAY_OFFSET;
}

/** [P(teamA wins), P(teamB wins)] from each team's current ratings, for a match preview - openskill's own win predictor. */
export function winProbabilities(
  teamA: OpenSkillRating[],
  teamB: OpenSkillRating[],
): [number, number] {
  const [probA, probB] = predictWin([teamA, teamB]);
  return [probA, probB];
}

/**
 * Games threshold below which a score gap is normal match variance rather
 * than dominance - e.g. a 7-6 single-set edge (gap of 1 game) shouldn't
 * amplify the rating swing.
 */
const MARGIN_GAMES = 1;

/**
 * Share of a team's total mu change attributed to the seeded partner when
 * exactly one of the two is seeded - the admin's seeding call is itself a
 * (imperfect) signal about who's the stronger player and did more of the
 * work behind the result, which the model has no other way to know about
 * before rating history exists to reflect it. openskill declares a `weight`
 * option in its types for exactly this kind of thing, but it isn't actually
 * wired into any of the bundled models (checked in v5.0.1) - so this is
 * applied as a manual post-hoc redistribution of the team's total mu delta
 * instead, same pattern already used for margin-of-victory before v5 added
 * native support for that. A light skew, not a large one: the unseeded
 * partner still played the match and should still move meaningfully.
 */
const SEEDED_SHARE = 0.6;

/**
 * Redistributes a team's already-computed mu delta between two partners
 * using seed status instead of the library's own sigma-proportional split -
 * only when exactly one of the two was seeded (a real signal). Falls back to
 * the library's own split when seed status doesn't differentiate them (both
 * seeded, both unseeded, or unknown - e.g. an admin-picked fixed pair that
 * doesn't follow the seeded+unseeded randomizer convention).
 */
function redistributeBySeed(
  pre: [OpenSkillRating, OpenSkillRating],
  post: [OpenSkillRating, OpenSkillRating],
  seeded: [boolean, boolean],
): [OpenSkillRating, OpenSkillRating] {
  if (seeded[0] === seeded[1]) return post;

  const totalDelta = post[0].mu - pre[0].mu + (post[1].mu - pre[1].mu);
  const seededIndex = seeded[0] ? 0 : 1;
  const unseededIndex = seededIndex === 0 ? 1 : 0;

  const result: [OpenSkillRating, OpenSkillRating] = [...post];
  result[seededIndex] = {
    mu: pre[seededIndex].mu + SEEDED_SHARE * totalDelta,
    sigma: post[seededIndex].sigma,
  };
  result[unseededIndex] = {
    mu: pre[unseededIndex].mu + (1 - SEEDED_SHARE) * totalDelta,
    sigma: post[unseededIndex].sigma,
  };
  return result;
}

/**
 * Updates a 2v2 doubles match. `winner` decides who gains/loses rating -
 * `gamesA`/`gamesB` (total games won across all sets) only scale *how much*,
 * via openskill's built-in margin-of-victory support (`score`/`margin`
 * options), which only touches mu and leaves the library's own sigma update
 * untouched. A team's rating change is then split between partners by seed
 * status when it differentiates them (see redistributeBySeed), otherwise by
 * each player's own uncertainty (sigma) - a newer/less-established partner
 * absorbs a bigger share of the swing than a well-established one, since the
 * match result alone can't separate individual contribution within a team.
 */
export function updateDoublesMatch(
  teamA: [OpenSkillRating, OpenSkillRating],
  teamB: [OpenSkillRating, OpenSkillRating],
  winner: "A" | "B",
  gamesA: number,
  gamesB: number,
  seededA: [boolean, boolean],
  seededB: [boolean, boolean],
): { teamA: [OpenSkillRating, OpenSkillRating]; teamB: [OpenSkillRating, OpenSkillRating] } {
  const [ratedA, ratedB] = rate([teamA, teamB], {
    // Rank comes from the actual match winner, never derived from the score
    // (the winner isn't guaranteed to have the higher aggregate game count -
    // see the dominance-clamp note in dominance.ts).
    rank: winner === "A" ? [0, 1] : [1, 0],
    score: [gamesA, gamesB],
    margin: MARGIN_GAMES,
  });
  return {
    teamA: redistributeBySeed(teamA, [ratedA[0], ratedA[1]], seededA),
    teamB: redistributeBySeed(teamB, [ratedB[0], ratedB[1]], seededB),
  };
}
