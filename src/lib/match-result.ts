export type SetScore = { sideAGames: number; sideBGames: number };
export type MatchSide = "A" | "B";

export function determineSetWinner(set: SetScore): MatchSide | null {
  if (set.sideAGames === set.sideBGames) return null;
  return set.sideAGames > set.sideBGames ? "A" : "B";
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
