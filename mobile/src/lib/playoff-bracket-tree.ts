import type { Match, Side } from '@/features/matches/types';

/** Mirrors BRACKET_ROUNDS/FINAL_ROUND (src/lib/playoff-rounds.ts on the web) - the fixed
 * single-elimination stage labels this tree understands, shallowest first. */
export const FINAL_ROUND = 'Фінал';
export const BRACKET_ROUNDS = ['1/8', '1/4', '1/2', FINAL_ROUND] as const;
const BRONZE_ROUND = 'За 3 місце';

export type BracketSide = { playerIds: string[]; source: BracketNode | null };
export type BracketNode = { match: Match; round: string; sideA: BracketSide; sideB: BracketSide };
export type BracketColumn = { round: string; nodes: BracketNode[] };
export type BracketTree = { columns: BracketColumn[]; bronze: Match | null };

function playerIdSet(match: Match, side: Side): string[] {
  return match.players
    .filter((p) => p.side === side)
    .map((p) => p.playerId)
    .sort();
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Ported from src/lib/playoff-bracket-tree.ts on the web - see its own doc
 * comment for why this matches by winning-side roster identity instead of a
 * MatchAdvancement row (most tournaments never get one for a plain bracket).
 */
function findWinnerMatch(candidates: Match[], ids: string[], used: Set<string>): Match | undefined {
  if (ids.length === 0) return undefined;
  return candidates.find((m) => {
    if (used.has(m.id) || m.status !== 'COMPLETED' || !m.winnerSide) return false;
    return sameIds(playerIdSet(m, m.winnerSide), ids);
  });
}

function resolveNode(match: Match, matchesByRound: Map<string, Match[]>, used: Set<string>): BracketNode {
  used.add(match.id);
  const round = match.round as string;
  const idx = BRACKET_ROUNDS.indexOf(round as (typeof BRACKET_ROUNDS)[number]);
  const predecessorRound = idx > 0 ? BRACKET_ROUNDS[idx - 1] : null;
  const candidates = predecessorRound ? (matchesByRound.get(predecessorRound) ?? []) : [];

  function resolveSide(side: Side): BracketSide {
    const ids = playerIdSet(match, side);
    const sourceMatch = findWinnerMatch(candidates, ids, used);
    return { playerIds: ids, source: sourceMatch ? resolveNode(sourceMatch, matchesByRound, used) : null };
  }

  // sideA resolved (and its whole subtree marked `used`) before sideB starts looking - see the
  // web version's own comment for why (keeps two same-roster matches from claiming one source).
  const sideA = resolveSide('A');
  const sideB = resolveSide('B');
  return { match, round, sideA, sideB };
}

/**
 * Builds the single-elimination bracket tree (1/8 -> 1/4 -> 1/2 -> Фінал, plus the bronze-medal
 * match as a standalone box), or null if there's no "Фінал" match to root it at, or the tree
 * would just be that one lone box.
 */
export function buildBracketTree(matches: Match[]): BracketTree | null {
  const matchesByRound = new Map<string, Match[]>();
  for (const round of BRACKET_ROUNDS) {
    matchesByRound.set(round, matches.filter((m) => m.round === round));
  }

  const finals = matchesByRound.get(FINAL_ROUND) ?? [];
  if (finals.length !== 1) return null;

  const used = new Set<string>();
  const root = resolveNode(finals[0], matchesByRound, used);

  const columnsMap = new Map<string, BracketNode[]>();
  function collect(node: BracketNode) {
    if (node.sideA.source) collect(node.sideA.source);
    if (node.sideB.source) collect(node.sideB.source);
    const list = columnsMap.get(node.round);
    if (list) list.push(node);
    else columnsMap.set(node.round, [node]);
  }
  collect(root);

  const columns: BracketColumn[] = BRACKET_ROUNDS.filter((r) => columnsMap.has(r)).map((r) => ({
    round: r,
    nodes: columnsMap.get(r)!,
  }));

  const bronzeMatches = matches.filter((m) => m.round === BRONZE_ROUND);
  const bronze = bronzeMatches.length === 1 ? bronzeMatches[0] : null;

  const totalNodes = columns.reduce((n, c) => n + c.nodes.length, 0) + (bronze ? 1 : 0);
  if (totalNodes < 2) return null;

  return { columns, bronze };
}
