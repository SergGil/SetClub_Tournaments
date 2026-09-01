// Pure display-math mirrors of src/lib/rating/{glicko2,openskill}.ts - cheap,
// dependency-free duplication (no server access needed), same convention as
// the rest of mobile/src/features/*/types.ts.

export type Glicko2Rating = { rating: number; rd: number; volatility: number };
export type OpenSkillRating = { mu: number; sigma: number };

/** Mirrors conservativeRating (src/lib/rating/glicko2.ts) - rating - 2*rd. */
export function conservativeRating(r: Glicko2Rating): number {
  return r.rating - 2 * r.rd;
}

const DISPLAY_SCALE = 1500 / 25 / 3;
const CONSERVATIVE_DISPLAY_OFFSET = 1000;

function displayRating(mu: number): number {
  return 1500 + (mu - 25) * DISPLAY_SCALE;
}

/** Mirrors displaySpread (src/lib/rating/openskill.ts). */
export function displaySpread(sigma: number): number {
  return sigma * DISPLAY_SCALE;
}

/** Mirrors conservativeOrdinal (src/lib/rating/openskill.ts) - OpenSkill ordinal(z:3) rescaled + CONSERVATIVE_DISPLAY_OFFSET. */
export function conservativeOrdinal(r: OpenSkillRating): number {
  const ordinal = r.mu - 3 * r.sigma;
  return displayRating(ordinal) + CONSERVATIVE_DISPLAY_OFFSET;
}
