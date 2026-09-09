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
  /** "Очки" - 2 for winning a single-set match, else 1 per set won (see computeMatchPoints). */
  points: number;
  /** True when the participant is marked as seeded - only used to order an otherwise-tied group (see cascadeSort's final fallback), never as a ranking criterion once results exist. */
  seed?: boolean;
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

/**
 * Before a group has any games at all, gamesDiff is 0-0 for everyone, so
 * this fallback decides the entire visible order: seeded participants first
 * (matching how the group was drawn), then alphabetically - rather than the
 * incidental "whoever the standings query happened to list first" order.
 */
function bySeedThenName(a: StandingsRow, b: StandingsRow): number {
  const seedRankA = a.seed ? 0 : 1;
  const seedRankB = b.seed ? 0 : 1;
  if (seedRankA !== seedRankB) return seedRankA - seedRankB;
  return a.label.localeCompare(b.label);
}

function byGamesDiff(a: StandingsRow, b: StandingsRow): number {
  const diffA = a.gamesWon - a.gamesLost;
  const diffB = b.gamesWon - b.gamesLost;
  return diffB - diffA;
}

/** Total games won, ahead of just the differential - two rows can tie on diff (e.g. 10:10 vs 11:11) while one clearly won more games overall. */
function byGamesWon(a: StandingsRow, b: StandingsRow): number {
  return b.gamesWon - a.gamesWon;
}

/**
 * Orders a group of rows tied on wins and win %, cascading through
 * progressively finer numeric criteria (game differential, then total games
 * won) - each one only breaks ties left by the previous, so a group can
 * split into several still-tied subgroups at any step. Head-to-head is
 * tried last, and only once a subgroup has narrowed to exactly two rows
 * still tied on every numeric criterion: for 3+ rows it can cycle (A beat
 * B, B beat C, C beat A), so it's never trusted to resolve a larger group,
 * or to override a real numeric edge one row already holds over another.
 * Whatever's left tied after all of that (a 2-row subgroup with no h2h
 * result recorded, or any group of 3+ still fully tied) falls back to seed
 * then name.
 */
function sortTiedGroup(group: StandingsRow[], h2h: HeadToHead): StandingsRow[] {
  return cascadeSort(group, h2h, [byGamesDiff, byGamesWon]);
}

function cascadeSort(
  group: StandingsRow[],
  h2h: HeadToHead,
  remainingCriteria: ((a: StandingsRow, b: StandingsRow) => number)[],
): StandingsRow[] {
  if (remainingCriteria.length === 0) {
    if (group.length === 2) {
      const [a, b] = group;
      const h2hResult = compareHeadToHead(a.key, b.key, h2h);
      if (h2hResult !== 0) return h2hResult < 0 ? [a, b] : [b, a];
    }
    return [...group].sort(bySeedThenName);
  }

  const [criterion, ...restCriteria] = remainingCriteria;
  const sorted = [...group].sort(criterion);
  const result: StandingsRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && criterion(sorted[i], sorted[j]) === 0) j += 1;
    result.push(...cascadeSort(sorted.slice(i, j), h2h, restCriteria));
    i = j;
  }
  return result;
}

/**
 * Ranks standings rows: most wins first, ties broken by win % (in case rows
 * played an uneven number of matches), then - within each remaining tied
 * group - game differential, then total games won, then head-to-head (only
 * once exactly two rows remain tied on everything numeric), and finally
 * seed/name.
 */
/**
 * True once every row has a recorded result (in either direction) against
 * every other row - i.e. the round robin has actually been played out, not
 * just "each row has played *some* match count >= rows.length - 1" (which a
 * manually-created duplicate match between the same two rows can satisfy
 * without the rest of the group ever meeting).
 */
export function isRoundRobinComplete(rows: StandingsRow[], h2h: HeadToHead): boolean {
  if (rows.length < 2) return false;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i].key;
      const b = rows[j].key;
      if (!h2h.get(a)?.has(b) && !h2h.get(b)?.has(a)) return false;
    }
  }
  return true;
}

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
