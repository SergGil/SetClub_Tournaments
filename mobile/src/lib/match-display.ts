/** Groups are shown to admins/players as letters (A-F) - mirrors groupRoundLabel (src/lib/randomize-pairs.ts on the web). */
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function groupRoundLabel(group: number): string {
  return `Група ${GROUP_LETTERS[group - 1] ?? group}`;
}

/** Shape of a Match's own `advancementsAsTarget` row (matchWithDetailsInclude/padelMatchWithDetailsInclude on the web). */
export type MatchAdvancementInfo = {
  side: 'A' | 'B';
  source: 'GROUP_RANK' | 'MATCH_RESULT';
  sourceGroup: number | null;
  sourceRank: number | null;
  outcome: 'WINNER' | 'LOSER' | null;
  sourceMatch: { round: string | null } | null;
};

const ORDINAL_PLACE: Record<number, string> = { 2: '2-ге', 3: '3-тє', 4: '4-те', 5: '5-те', 6: '6-те' };

/**
 * Human-readable placeholder for a bracket-randomizer slot that hasn't been
 * decided yet ("Переможець Групи A", "Той, хто програв 1/2") instead of a
 * bare "?" - ported from src/lib/match-display.ts on the web (see
 * docs/GROUPS12_PLAYOFF.md, docs/DOUBLES_GROUP_PLAYOFF.md). Skips the web
 * version's legacy round-label normalization (old pre-rename round strings
 * like "Сіяні"/"Група 1") - a cosmetic-only gap for very old matches, not
 * worth porting the web's whole randomize-pairs.ts constant set for.
 */
export function emptySlotLabel(info: MatchAdvancementInfo): string {
  if (info.source === 'GROUP_RANK' && info.sourceGroup != null && info.sourceRank != null) {
    const letter = groupRoundLabel(info.sourceGroup).replace('Група ', '');
    if (info.sourceRank === 1) return `Переможець Групи ${letter}`;
    const ordinal = ORDINAL_PLACE[info.sourceRank] ?? `${info.sourceRank}-те`;
    return `${ordinal} місце Групи ${letter}`;
  }
  if (info.source === 'MATCH_RESULT') {
    const round = info.sourceMatch?.round ?? 'попереднього матчу';
    return info.outcome === 'WINNER' ? `Переможець ${round}` : `Той, хто програв ${round}`;
  }
  return '?';
}
