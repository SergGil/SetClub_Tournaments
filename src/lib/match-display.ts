import { groupRoundLabel, MAX_TOURNAMENT_GROUPS, SINGLES_GROUP_LABEL } from "@/lib/randomize-pairs";

export const MATCH_TYPE_LABEL = { SINGLES: "1×1", DOUBLES: "2×2" } as const;

// SINGLES_GROUP_LABEL used to be the plain "Сіяні"/"Несіяні", and
// groupRoundLabel used to spell out the group as a plain number ("Група 1")
// instead of a letter ("Група A") - matches created before either label
// changed still have the old string stored in `round` (it's data, not just
// display text), so old and new tournaments would otherwise show mismatched
// wording for the same group. Normalizing here is display-only and doesn't
// touch the database.
const LEGACY_ROUND_LABEL: Record<string, string> = {
  Сіяні: SINGLES_GROUP_LABEL.SEEDED,
  Несіяні: SINGLES_GROUP_LABEL.UNSEEDED,
  ...Object.fromEntries(
    Array.from({ length: MAX_TOURNAMENT_GROUPS }, (_, i) => [`Група ${i + 1}`, groupRoundLabel(i + 1)]),
  ),
};

export function normalizeRoundLabel(round: string): string {
  return LEGACY_ROUND_LABEL[round] ?? round;
}

/** Shape of a Match/PadelMatch's own `advancementsAsTarget` row (matchWithDetailsInclude/padelMatchWithDetailsInclude). */
export type MatchAdvancementInfo = {
  side: "A" | "B";
  source: "GROUP_RANK" | "MATCH_RESULT";
  sourceGroup: number | null;
  sourceRank: number | null;
  outcome: "WINNER" | "LOSER" | null;
  sourceMatch: { round: string | null } | null;
};

const ORDINAL_PLACE: Record<number, string> = { 2: "2-ге", 3: "3-тє", 4: "4-те", 5: "5-те", 6: "6-те" };

/**
 * Human-readable placeholder for a bracket-randomizer slot that hasn't been
 * decided yet ("Переможець Групи A", "Той, хто програв 1/2") instead of a
 * bare "?" - resolved from this match's own MatchAdvancement row for that
 * side (see docs/GROUPS12_PLAYOFF.md, docs/DOUBLES_GROUP_PLAYOFF.md). Falls
 * back to a generic phrase if a group/source round can't be resolved (a
 * stale or hand-edited row) rather than showing nothing.
 */
export function emptySlotLabel(info: MatchAdvancementInfo): string {
  if (info.source === "GROUP_RANK" && info.sourceGroup != null && info.sourceRank != null) {
    const letter = groupRoundLabel(info.sourceGroup).replace("Група ", "");
    if (info.sourceRank === 1) return `Переможець Групи ${letter}`;
    const ordinal = ORDINAL_PLACE[info.sourceRank] ?? `${info.sourceRank}-те`;
    return `${ordinal} місце Групи ${letter}`;
  }
  if (info.source === "MATCH_RESULT") {
    const round = info.sourceMatch?.round ? normalizeRoundLabel(info.sourceMatch.round) : "попереднього матчу";
    return info.outcome === "WINNER" ? `Переможець ${round}` : `Той, хто програв ${round}`;
  }
  return "?";
}
