export type StandingsRow = {
  key: string;
  label: string;
  href?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesWon: number;
  gamesLost: number;
};

export type HeadToHeadTally = { wins: number; losses: number };
/** rowKey -> opponentRowKey -> this row's record against that opponent. */
export type HeadToHead = Map<string, Map<string, HeadToHeadTally>>;

export function recordHeadToHead(h2h: HeadToHead, winnerKey: string, loserKey: string): void {
  const winnerRow = h2h.get(winnerKey) ?? new Map<string, HeadToHeadTally>();
  const winnerTally = winnerRow.get(loserKey) ?? { wins: 0, losses: 0 };
  winnerTally.wins += 1;
  winnerRow.set(loserKey, winnerTally);
  h2h.set(winnerKey, winnerRow);

  const loserRow = h2h.get(loserKey) ?? new Map<string, HeadToHeadTally>();
  const loserTally = loserRow.get(winnerKey) ?? { wins: 0, losses: 0 };
  loserTally.losses += 1;
  loserRow.set(winnerKey, loserTally);
  h2h.set(loserKey, loserRow);
}

/** Negative when `keyA` holds a head-to-head edge over `keyB` (so A ranks first); 0 if they never met. */
function compareHeadToHead(keyA: string, keyB: string, h2h: HeadToHead): number {
  const record = h2h.get(keyA)?.get(keyB);
  if (!record) return 0;
  return record.losses - record.wins;
}

/**
 * `winPct` on a StandingsRow is pre-rounded for display, so two rows with
 * different match counts can round to the same percentage (2/15 = 13.3% and
 * 2/16 = 12.5% both round to 13%) and get wrongly treated as an exact tie.
 * Recompute the unrounded ratio from wins/matchesPlayed for comparisons.
 */
function exactWinRatio(row: StandingsRow): number {
  return row.matchesPlayed > 0 ? row.wins / row.matchesPlayed : 0;
}

function byGamesDiffThenName(a: StandingsRow, b: StandingsRow): number {
  const diffA = a.gamesWon - a.gamesLost;
  const diffB = b.gamesWon - b.gamesLost;
  if (diffB !== diffA) return diffB - diffA;
  return a.label.localeCompare(b.label);
}

/**
 * Orders a group of rows tied on wins and win %. Head-to-head only produces
 * a consistent order for exactly two rows - for 3+ it can cycle (A beat B,
 * B beat C, C beat A), so a plain pairwise comparator would give a sort
 * result that depends on the engine's comparison order rather than any
 * real ranking. Games differential is transitive and always safe.
 */
function sortTiedGroup(group: StandingsRow[], h2h: HeadToHead): StandingsRow[] {
  if (group.length === 2) {
    const [a, b] = group;
    const h2hResult = compareHeadToHead(a.key, b.key, h2h);
    if (h2hResult !== 0) return h2hResult < 0 ? [a, b] : [b, a];
  }
  return [...group].sort(byGamesDiffThenName);
}

/**
 * Ranks standings rows: most wins first, ties broken by win % (in case rows
 * played an uneven number of matches), then - within each remaining tied
 * group - head-to-head when it's a clean two-way tie, else game
 * differential and finally name.
 */
export function sortRows(rows: StandingsRow[], h2h: HeadToHead): StandingsRow[] {
  const byPrimary = [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return exactWinRatio(b) - exactWinRatio(a);
  });

  const result: StandingsRow[] = [];
  let i = 0;
  while (i < byPrimary.length) {
    let j = i + 1;
    while (
      j < byPrimary.length &&
      byPrimary[j].wins === byPrimary[i].wins &&
      exactWinRatio(byPrimary[j]) === exactWinRatio(byPrimary[i])
    ) {
      j += 1;
    }
    result.push(...sortTiedGroup(byPrimary.slice(i, j), h2h));
    i = j;
  }
  return result;
}
