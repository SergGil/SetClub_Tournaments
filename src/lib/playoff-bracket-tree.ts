import { BRACKET_ROUNDS, FINAL_ROUND } from "@/lib/playoff-rounds";
import type { MatchWithDetails } from "@/lib/queries/matches";

const BRONZE_ROUND = "За 3 місце";

export type BracketSide = {
  playerIds: string[];
  source: BracketNode | null;
};

export type BracketNode = {
  match: MatchWithDetails;
  round: string;
  sideA: BracketSide;
  sideB: BracketSide;
};

export type BracketColumn = { round: string; nodes: BracketNode[] };

export type BracketTree = {
  /** Shallowest round first, "Фінал" last. */
  columns: BracketColumn[];
  bronze: MatchWithDetails | null;
};

function playerIdSet(match: MatchWithDetails, side: "A" | "B"): string[] {
  return match.players
    .filter((p) => p.side === side)
    .map((p) => p.playerId)
    .sort();
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Finds the completed match in `candidates` whose WINNING side's roster is
 * exactly `ids` - this is how the tree gets wired, not MatchAdvancement:
 * most tournaments in this club (all but one, checked against the dev DB)
 * never get MatchAdvancement rows at all, since those only exist for the
 * groups+playoff randomizer flows, not plain single-elimination brackets
 * built match by match. Matching by actual roster identity instead works
 * for every tournament regardless of how its matches were created, and is
 * correct by construction: either a real earlier match's winner really is
 * this side's roster, or there's nothing to connect - never a guessed/wrong
 * connector line.
 */
function findWinnerMatch(candidates: MatchWithDetails[], ids: string[], used: Set<string>): MatchWithDetails | undefined {
  if (ids.length === 0) return undefined;
  return candidates.find((m) => {
    if (used.has(m.id) || m.status !== "COMPLETED" || !m.winnerSide) return false;
    return sameIds(playerIdSet(m, m.winnerSide), ids);
  });
}

function resolveNode(match: MatchWithDetails, matchesByRound: Map<string, MatchWithDetails[]>, used: Set<string>): BracketNode {
  used.add(match.id);
  const round = match.round as string;
  const idx = BRACKET_ROUNDS.indexOf(round as (typeof BRACKET_ROUNDS)[number]);
  const predecessorRound = idx > 0 ? BRACKET_ROUNDS[idx - 1] : null;
  const candidates = predecessorRound ? (matchesByRound.get(predecessorRound) ?? []) : [];

  function resolveSide(side: "A" | "B"): BracketSide {
    const ids = playerIdSet(match, side);
    const sourceMatch = findWinnerMatch(candidates, ids, used);
    return { playerIds: ids, source: sourceMatch ? resolveNode(sourceMatch, matchesByRound, used) : null };
  }

  // sideA resolved (and its whole subtree marked `used`) before sideB starts
  // looking - keeps two same-roster matches (shouldn't happen, but data can
  // be messy) from both claiming the same earlier match as their source.
  const sideA = resolveSide("A");
  const sideB = resolveSide("B");
  return { match, round, sideA, sideB };
}

/**
 * Builds the single-elimination bracket tree (1/8 → 1/4 → 1/2 → Фінал, plus
 * the bronze-medal match as a standalone box) for one tournament's playoff
 * matches, or null if there's no "Фінал" match to root it at, or the tree
 * would just be that one lone box (not worth a distinct view from the plain
 * list). Deliberately never covers the placement rounds (За 5/7/9/11 місце)
 * or the group stage - those don't form a single connected tree the same
 * way (docs/DESIGN_ROADMAP_2026.md #2).
 */
export function buildBracketTree(matches: MatchWithDetails[]): BracketTree | null {
  const matchesByRound = new Map<string, MatchWithDetails[]>();
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
