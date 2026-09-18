import { emptySlotLabel } from '@/lib/match-display';

import type { Match, Side } from './types';

/** Shows a bracket-randomizer slot's own emptySlotLabel ("Переможець Групи A") instead of a bare "?" when this side has no players yet - see lib/match-display.ts. Falls back to "?" for an ordinary match still waiting on an admin to fill in players by hand (advancementsAsTarget is [] there). */
export function sideNames(match: Match, side: Side): string {
  const names = match.players.filter((p) => p.side === side).map((p) => p.player.name);
  if (names.length > 0) return names.join(' / ');
  // Defensive `?? []` even though the type says this is always an array (every real
  // matchWithDetailsInclude/padelMatchWithDetailsInclude response includes it) - same guard the
  // web version keeps despite the same non-optional type, in case a future code path ever builds
  // a partial Match client-side without it.
  const advancement = (match.advancementsAsTarget ?? []).find((a) => a.side === side);
  return advancement ? emptySlotLabel(advancement) : '?';
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

/** One side's own per-set games, space-separated ("6 4" for a 6-4/4-6 match) - used by the bracket view's compact match boxes, which show each side on its own line (unlike scoreSummary's combined "6-4 6-3"). */
export function sideScore(match: Match, side: Side): string {
  if (match.walkover) return 'тех.';
  if (match.sets.length === 0) return '';
  return match.sets.map((s) => (side === 'A' ? s.sideAGames : s.sideBGames)).join(' ');
}
