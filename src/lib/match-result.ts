export type SetScore = { sideAGames: number; sideBGames: number };
export type MatchSide = "A" | "B";

export function determineSetWinner(set: SetScore): MatchSide | null {
  if (set.sideAGames === set.sideBGames) return null;
  return set.sideAGames > set.sideBGames ? "A" : "B";
}

/** A standard advantage set: first to 6 by 2+, or 7-5, or 7-6 (a 7-point tiebreak). */
export function isValidClassicSet(a: number, b: number): boolean {
  return (
    (a === 6 && b <= 4) ||
    (b === 6 && a <= 4) ||
    (a === 7 && (b === 5 || b === 6)) ||
    (b === 7 && (a === 5 || a === 6))
  );
}

/**
 * A match (super) tiebreak played to 10, win by 2+, recorded as the raw point
 * score (e.g. 10-7, 10-8, 12-10) rather than as a regular set.
 */
export function isValidSuperTiebreak(a: number, b: number): boolean {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  return (winner === 10 && loser <= 8) || (winner >= 11 && winner - loser === 2);
}

/**
 * Whether a set's score is a legal result. `allowSuperTiebreak` is for the
 * decisive (3rd) set in formats where the club replaces it with a match
 * tiebreak instead of playing a full set.
 */
export function isValidSetScore(set: SetScore, allowSuperTiebreak: boolean): boolean {
  const { sideAGames: a, sideBGames: b } = set;
  if (isValidClassicSet(a, b)) return true;
  if (allowSuperTiebreak && isValidSuperTiebreak(a, b)) return true;
  return false;
}

/** True for a set that was decided by a 7-point tiebreak (7-6 either way). */
export function isTiebreakSet(a: number, b: number): boolean {
  return (a === 7 && b === 6) || (a === 6 && b === 7);
}

/**
 * By convention a 7-6 set's tiebreak is recorded as just the loser's points
 * (e.g. "7-6(5)") - the winner's points are implied: 7 if the loser got 5 or
 * fewer, otherwise loserPoints + 2 (the breaker went past 7-5, win by 2).
 * Any non-negative point count is a legal loser score under that rule.
 */
export function isValidTiebreakLoserPoints(loserPoints: number): boolean {
  return Number.isInteger(loserPoints) && loserPoints >= 0;
}

/** Winner is whoever won more sets. Returns null if there are no sets or the sets are tied. */
export function determineMatchWinner(sets: SetScore[]): MatchSide | null {
  let aSets = 0;
  let bSets = 0;
  for (const set of sets) {
    const winner = determineSetWinner(set);
    if (winner === "A") aSets += 1;
    else if (winner === "B") bSets += 1;
  }
  if (aSets === bSets) return null;
  return aSets > bSets ? "A" : "B";
}
