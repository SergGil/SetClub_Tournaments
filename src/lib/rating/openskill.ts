import { ordinal, rate, rating } from "openskill";

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

/** displayRating(mu - 3*sigma) - OpenSkill's own conservative-leaderboard convention (Xbox Live TrueSkill). */
export function conservativeOrdinal(r: OpenSkillRating): number {
  return displayRating(ordinal(r, { z: 3 }));
}

/**
 * Games threshold below which a score gap is normal match variance rather
 * than dominance - e.g. a 7-6 single-set edge (gap of 1 game) shouldn't
 * amplify the rating swing.
 */
const MARGIN_GAMES = 1;

/**
 * Updates a 2v2 doubles match. `winner` decides who gains/loses rating -
 * `gamesA`/`gamesB` (total games won across all sets) only scale *how much*,
 * via openskill's built-in margin-of-victory support (`score`/`margin`
 * options), which only touches mu and leaves the library's own sigma update
 * untouched. A team's rating change is split between partners in proportion
 * to each player's own uncertainty (sigma) - a newer/less-established
 * partner absorbs a bigger share of the swing than a well-established one,
 * since the match result can't otherwise separate individual contribution
 * within a team.
 */
export function updateDoublesMatch(
  teamA: [OpenSkillRating, OpenSkillRating],
  teamB: [OpenSkillRating, OpenSkillRating],
  winner: "A" | "B",
  gamesA: number,
  gamesB: number,
): { teamA: [OpenSkillRating, OpenSkillRating]; teamB: [OpenSkillRating, OpenSkillRating] } {
  const [ratedA, ratedB] = rate([teamA, teamB], {
    // Rank comes from the actual match winner, never derived from the score
    // (the winner isn't guaranteed to have the higher aggregate game count -
    // see the dominance-clamp note in dominance.ts).
    rank: winner === "A" ? [0, 1] : [1, 0],
    score: [gamesA, gamesB],
    margin: MARGIN_GAMES,
  });
  return { teamA: [ratedA[0], ratedA[1]], teamB: [ratedB[0], ratedB[1]] };
}
