/**
 * Retirement with zero games recorded (conceded before any game was played) -
 * neutral fallback: not 1.0 (no scoring evidence for a shutout) but above 0.5
 * (we do know someone won).
 */
export const DEFAULT_DOMINANCE_NO_GAMES = 0.75;

/**
 * How convincingly the match was won, as a continuous score in [0.5, 1] fed
 * into Glicko-2 in place of a binary win/loss outcome (see glicko2.ts).
 *
 * The match winner isn't guaranteed to have won more *aggregate* games across
 * all sets (e.g. 7-6, 0-6, 7-6: winner games 14, loser games 18) - clamp to
 * 0.5 so a legitimate win never reads as a below-average outcome.
 */
export function computeDominance(
  sets: { sideAGames: number; sideBGames: number }[],
  winnerSide: "A" | "B",
): number {
  let winnerGames = 0;
  let loserGames = 0;
  for (const set of sets) {
    winnerGames += winnerSide === "A" ? set.sideAGames : set.sideBGames;
    loserGames += winnerSide === "A" ? set.sideBGames : set.sideAGames;
  }
  if (winnerGames + loserGames === 0) return DEFAULT_DOMINANCE_NO_GAMES;
  return Math.max(0.5, winnerGames / (winnerGames + loserGames));
}
