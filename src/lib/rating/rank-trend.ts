/**
 * Drops every row belonging to the single most recent tournament (by
 * `tournamentStartDate`) in the given set - used to recompute a rating/points
 * table exactly as it looked *before* that tournament, for the "did my rank
 * change" arrow (see buildRankDeltaMap). Takes whatever row set the caller
 * already narrowed to (one format, one SET.club season) rather than always
 * "every match in the club" - the "latest tournament" must be relative to
 * what's actually being displayed, not the whole match history.
 */
export function excludeLatestTournament<T extends { tournamentId: string; tournamentStartDate: number }>(
  rows: T[],
): T[] {
  if (rows.length === 0) return rows;
  const latestTournamentId = rows.reduce((latest, row) =>
    row.tournamentStartDate > latest.tournamentStartDate ? row : latest,
  ).tournamentId;
  return rows.filter((row) => row.tournamentId !== latestTournamentId);
}

/**
 * How many places each player moved between two rankings, both given as
 * playerId arrays already in place order (index 0 = 1st place). Positive
 * means the player climbed (their previous index was larger/worse);
 * negative means they dropped. A player absent from `previousOrder` (their
 * very first tournament) gets no entry at all - a debut isn't "no change",
 * so the caller should render nothing rather than a "0".
 */
export function buildRankDeltaMap(currentOrder: string[], previousOrder: string[]): Map<string, number> {
  const previousIndexById = new Map(previousOrder.map((playerId, index) => [playerId, index]));
  const deltas = new Map<string, number>();
  currentOrder.forEach((playerId, currentIndex) => {
    const previousIndex = previousIndexById.get(playerId);
    if (previousIndex === undefined) return;
    deltas.set(playerId, previousIndex - currentIndex);
  });
  return deltas;
}
