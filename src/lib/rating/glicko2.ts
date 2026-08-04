/**
 * Hand-rolled Glicko-2 (Mark Glickman, http://www.glicko.net/glicko/glicko2.pdf).
 *
 * Off-the-shelf Glicko-2 packages only accept a binary/draw outcome (0, 0.5,
 * 1). This rating system needs a continuous margin-of-victory score in
 * [0, 1] instead (see dominance.ts) - the update formulas below are valid
 * for any score in that range, but feeding anything other than {0, 0.5, 1}
 * is an informal adaptation of Glickman's spec, not the official algorithm.
 * Kept honest about that in the informer copy on /rating.
 */

export const GLICKO2_SCALE = 173.7178;
/** Glickman recommends 0.3-1.2 for the system constant; 0.5 is a common production default. */
export const GLICKO2_TAU = 0.5;

export type Glicko2Rating = { rating: number; rd: number; volatility: number };

export const GLICKO2_DEFAULT: Glicko2Rating = { rating: 1500, rd: 350, volatility: 0.06 };

/** One opponent faced during a rating period, with a margin-of-victory score in [0, 1]. */
export type Glicko2Result = { opponent: Glicko2Rating; score: number };

function toGlicko2Scale(r: Glicko2Rating): { mu: number; phi: number } {
  return { mu: (r.rating - 1500) / GLICKO2_SCALE, phi: r.rd / GLICKO2_SCALE };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/** Glickman's iterative (Illinois-algorithm) solve for the new volatility, sigma'. */
function solveVolatility(phi: number, sigma: number, v: number, delta: number, tau: number): number {
  const a = Math.log(sigma * sigma);
  const epsilon = 0.000001;

  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) ** 2;
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Applies one Glicko-2 rating-period update. `results = []` runs the "no
 * games this period" branch: rating and volatility are unchanged, RD
 * inflates toward the uncertainty ceiling.
 */
export function updateGlicko2Period(
  player: Glicko2Rating,
  results: Glicko2Result[],
  tau: number = GLICKO2_TAU,
): Glicko2Rating {
  const { mu, phi } = toGlicko2Scale(player);

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + player.volatility * player.volatility);
    return { rating: player.rating, rd: phiStar * GLICKO2_SCALE, volatility: player.volatility };
  }

  const opponents = results.map(({ opponent, score }) => {
    const { mu: muJ, phi: phiJ } = toGlicko2Scale(opponent);
    const gPhiJ = g(phiJ);
    const eJ = expectedScore(mu, muJ, phiJ);
    return { gPhiJ, eJ, score };
  });

  const vInverse = opponents.reduce((sum, o) => sum + o.gPhiJ * o.gPhiJ * o.eJ * (1 - o.eJ), 0);
  const v = 1 / vInverse;

  const delta = v * opponents.reduce((sum, o) => sum + o.gPhiJ * (o.score - o.eJ), 0);

  const volatility = solveVolatility(phi, player.volatility, v, delta, tau);

  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * (delta / v);

  return {
    rating: newMu * GLICKO2_SCALE + 1500,
    rd: newPhi * GLICKO2_SCALE,
    volatility,
  };
}

/** rating - k*rd - the standard ~95%-lower-bound leaderboard convention (default k=2). */
export function conservativeRating(r: Glicko2Rating, k: number = 2): number {
  return r.rating - k * r.rd;
}

/** Probability that `player` beats `opponent`, from their current ratings - Glickman's own expected-score formula, exposed for match previews rather than just internal period updates. */
export function winProbability(player: Glicko2Rating, opponent: Glicko2Rating): number {
  const { mu } = toGlicko2Scale(player);
  const { mu: muJ, phi: phiJ } = toGlicko2Scale(opponent);
  return expectedScore(mu, muJ, phiJ);
}
