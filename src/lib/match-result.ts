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
 * A "Pro Set": a single long set played to 8 instead of a full best-of-3 -
 * first to 8 by 2+, or 9-7, or 9-8 (still a 7-point tiebreak, just triggered
 * at 8-8 instead of 6-6). Never overlaps with isValidClassicSet's range (a
 * classic set never reaches 8+ games), so a set score can be checked against
 * both without ambiguity.
 */
export function isValidProSet(a: number, b: number): boolean {
  return (
    (a === 8 && b <= 6) ||
    (b === 8 && a <= 6) ||
    (a === 9 && (b === 7 || b === 8)) ||
    (b === 9 && (a === 7 || a === 8))
  );
}

/** Whether a-b is a legal "first to `minPoints`, win by 2+" tiebreak score. */
function isValidTiebreakToThreshold(a: number, b: number, minPoints: number): boolean {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  return (winner === minPoints && loser <= minPoints - 2) || (winner > minPoints && winner - loser === 2);
}

/**
 * A match (super) tiebreak played to 10, win by 2+, recorded as the raw point
 * score (e.g. 10-7, 10-8, 12-10) rather than as a regular set.
 */
export function isValidSuperTiebreak(a: number, b: number): boolean {
  return isValidTiebreakToThreshold(a, b, 10);
}

/** The 7-point breaker that decides a 6-6 set (e.g. 7-5, 8-6, 10-8). */
export function isValidGameTiebreak(a: number, b: number): boolean {
  return isValidTiebreakToThreshold(a, b, 7);
}

/**
 * Whether a set's score is a legal result. `allowSuperTiebreak` is for the
 * decisive (3rd) set in formats where the club replaces it with a match
 * tiebreak instead of playing a full set.
 */
export function isValidSetScore(set: SetScore, allowSuperTiebreak: boolean): boolean {
  const { sideAGames: a, sideBGames: b } = set;
  if (isValidClassicSet(a, b)) return true;
  if (isValidProSet(a, b)) return true;
  if (allowSuperTiebreak && isValidSuperTiebreak(a, b)) return true;
  return false;
}

/** True for a set decided by a 7-point tiebreak: 7-6 (a 6-game set) or 9-8 (an 8-game Pro Set), either way. */
export function isTiebreakSet(a: number, b: number): boolean {
  return (a === 7 && b === 6) || (a === 6 && b === 7) || (a === 9 && b === 8) || (a === 8 && b === 9);
}

/**
 * Whether a 7-6/6-7 set's recorded tiebreak score is consistent: it's a
 * legal breaker result, and whichever side won the breaker matches whichever
 * side has 7 games in the set (a set can't be won 6-7 by a tiebreak that A won).
 */
export function isValidSetTiebreak(set: SetScore, tiebreakA: number, tiebreakB: number): boolean {
  if (!isValidGameTiebreak(tiebreakA, tiebreakB)) return false;
  const setWinner = determineSetWinner(set);
  const tiebreakWinner: MatchSide | null =
    tiebreakA === tiebreakB ? null : tiebreakA > tiebreakB ? "A" : "B";
  return setWinner !== null && setWinner === tiebreakWinner;
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

/**
 * Standings "Очки" per side for one match. A single-set match has no
 * meaningful granularity - it's flatly worth 2 points to whoever won that
 * lone set. A multi-set match instead awards 1 point per set won, to
 * whichever side won it - so a 2-1 loser still earns 1 point for the set
 * they took, same as the winner earns 2 for the two they took.
 *
 * `winnerSide` is a fallback used when `sets` is empty (a walkover - always
 * zero sets) or when `retired` is true: a `retired` match's sets don't have
 * to form a complete, legal result (see the schema's comment on
 * Match.retired), and its winnerSide is picked explicitly by the admin for
 * exactly that reason - "the game count alone can't say who was actually
 * ahead when the match was conceded" (saveScoreAction) - so a retired
 * match always gets the same flat 2-0 split a walkover does, never derived
 * from whatever partial/incomplete set score happens to be recorded (that
 * could disagree with who's actually recorded as the winner, silently
 * awarding the retiring player points they didn't earn). Ignored - derived
 * from `sets` as usual - for a normal (non-retired) match with at least one
 * set.
 */
export function computeMatchPoints(
  sets: SetScore[],
  winnerSide: MatchSide | null = null,
  retired: boolean = false,
): { A: number; B: number } {
  if (retired || sets.length === 0) {
    return { A: winnerSide === "A" ? 2 : 0, B: winnerSide === "B" ? 2 : 0 };
  }
  if (sets.length === 1) {
    const winner = determineSetWinner(sets[0]);
    return { A: winner === "A" ? 2 : 0, B: winner === "B" ? 2 : 0 };
  }
  let a = 0;
  let b = 0;
  for (const set of sets) {
    const winner = determineSetWinner(set);
    if (winner === "A") a += 1;
    else if (winner === "B") b += 1;
  }
  return { A: a, B: b };
}
