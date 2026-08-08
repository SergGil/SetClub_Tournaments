import type { HeadToHeadMatchRow } from "@/lib/stats";

export type HeadToHeadCell = { wins: number; losses: number };

/**
 * Wins/losses matrix restricted to `playerIds`, keyed [rowPlayerId][colPlayerId].
 * Cell (x, y).wins counts matches where x and y were on opposite sides and x's
 * side won. Doubles teammates never face off, so a pair that only ever
 * partnered each other has no cell.
 */
export function buildHeadToHeadMatrix(
  rows: HeadToHeadMatchRow[],
  playerIds: string[],
): Map<string, Map<string, HeadToHeadCell>> {
  const idSet = new Set(playerIds);
  const matrix = new Map<string, Map<string, HeadToHeadCell>>(playerIds.map((id) => [id, new Map()]));

  function recordWin(winnerId: string, loserId: string) {
    const winnerRow = matrix.get(winnerId)!;
    const winnerCell = winnerRow.get(loserId) ?? { wins: 0, losses: 0 };
    winnerCell.wins += 1;
    winnerRow.set(loserId, winnerCell);

    const loserRow = matrix.get(loserId)!;
    const loserCell = loserRow.get(winnerId) ?? { wins: 0, losses: 0 };
    loserCell.losses += 1;
    loserRow.set(winnerId, loserCell);
  }

  // A walkover only credits the winner's side - the withdrawn player must
  // not take a personal loss for a match they never played (see
  // docs/WITHDRAWAL.md), so only their opponent's `wins` cell is bumped.
  function recordWalkoverWin(winnerId: string, loserId: string) {
    const winnerRow = matrix.get(winnerId)!;
    const winnerCell = winnerRow.get(loserId) ?? { wins: 0, losses: 0 };
    winnerCell.wins += 1;
    winnerRow.set(loserId, winnerCell);
  }

  for (const match of rows) {
    const sideA = match.players.filter((p) => p.side === "A" && idSet.has(p.playerId));
    const sideB = match.players.filter((p) => p.side === "B" && idSet.has(p.playerId));
    if (sideA.length === 0 || sideB.length === 0) continue;
    const [winners, losers] = match.winnerSide === "A" ? [sideA, sideB] : [sideB, sideA];
    for (const winner of winners) {
      for (const loser of losers) {
        if (match.walkover) recordWalkoverWin(winner.playerId, loser.playerId);
        else recordWin(winner.playerId, loser.playerId);
      }
    }
  }

  return matrix;
}

export function headToHeadCell(
  matrix: Map<string, Map<string, HeadToHeadCell>>,
  rowId: string,
  colId: string,
): HeadToHeadCell | undefined {
  return matrix.get(rowId)?.get(colId);
}
