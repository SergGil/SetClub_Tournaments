import type { Match, Side } from './types';

export function sideNames(match: Match, side: Side): string {
  return (
    match.players
      .filter((p) => p.side === side)
      .map((p) => p.player.name)
      .join(' / ') || '?'
  );
}

/** "6-4 6-3" style summary, "TB 7" suffix when a set's tiebreak points were recorded. */
export function scoreSummary(match: Match): string {
  if (match.sets.length === 0) return match.status === 'SCHEDULED' ? 'Не зіграно' : '—';
  return match.sets
    .map((set) => {
      const base = `${set.sideAGames}-${set.sideBGames}`;
      if (set.tiebreakSideAPoints != null && set.tiebreakSideBPoints != null) {
        return `${base}(${Math.min(set.tiebreakSideAPoints, set.tiebreakSideBPoints)})`;
      }
      return base;
    })
    .join(' ');
}
