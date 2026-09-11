import { FINAL_ROUND, LOWER_SEMIFINAL_ROUND } from "@/lib/playoff-rounds";

/** How a downstream match's side gets its team, once decided. */
export type BracketSlotSource =
  | { kind: "GROUP_RANK"; group: number; rank: 1 | 2 | 3 | 4 }
  | { kind: "MATCH_RESULT"; sourceMatchKey: string; outcome: "WINNER" | "LOSER" };

export type BracketMatchPlan = {
  key: string;
  round: string;
  sideA: BracketSlotSource;
  sideB: BracketSlotSource;
};

function matchResult(sourceMatchKey: string, outcome: "WINNER" | "LOSER"): BracketSlotSource {
  return { kind: "MATCH_RESULT", sourceMatchKey, outcome };
}

function groupRank(group: number, rank: 1 | 2 | 3 | 4): BracketSlotSource {
  return { kind: "GROUP_RANK", group, rank };
}

/**
 * Static topology of the 8 downstream (playerless-at-creation) matches for
 * the doubles "За групами" + плей-офф format - 2 built-in groups of 4 teams
 * each play a crossover semifinal bracket for places 1-8. Groups are
 * numbered 1=A, 2=B (TournamentParticipant.group), matching groupRoundLabel's
 * existing A-F letter mapping in src/lib/randomize-pairs.ts. See
 * docs/DOUBLES_GROUP_PLAYOFF.md.
 *
 * Purely descriptive data - no Prisma, no randomness. The commit action
 * (src/lib/actions/randomize-doubles.ts, and its Padel mirror) resolves each
 * `key` to a real Match id and each `sourceMatchKey` to that same id when
 * writing MatchAdvancement rows; the resolver (src/lib/bracket-advancement.ts)
 * never reads this module - it only ever consults the persisted
 * MatchAdvancement rows this plan was used to create.
 */
export const DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN: readonly BracketMatchPlan[] = [
  // Upper bracket (places 1-4): the two group winners cross with the other group's runner-up.
  { key: "SF_TOP", round: "1/2", sideA: groupRank(1, 1), sideB: groupRank(2, 2) },
  { key: "SF_BOTTOM", round: "1/2", sideA: groupRank(2, 1), sideB: groupRank(1, 2) },
  {
    key: "FINAL",
    round: FINAL_ROUND,
    sideA: matchResult("SF_TOP", "WINNER"),
    sideB: matchResult("SF_BOTTOM", "WINNER"),
  },
  {
    key: "THIRD_PLACE",
    round: "За 3 місце",
    sideA: matchResult("SF_TOP", "LOSER"),
    sideB: matchResult("SF_BOTTOM", "LOSER"),
  },

  // Lower bracket (places 5-8): the two groups' 3rd/4th-place finishers cross the same way.
  { key: "LOWER_SF_TOP", round: LOWER_SEMIFINAL_ROUND, sideA: groupRank(1, 3), sideB: groupRank(2, 4) },
  { key: "LOWER_SF_BOTTOM", round: LOWER_SEMIFINAL_ROUND, sideA: groupRank(2, 3), sideB: groupRank(1, 4) },
  {
    key: "FIFTH_PLACE",
    round: "За 5 місце",
    sideA: matchResult("LOWER_SF_TOP", "WINNER"),
    sideB: matchResult("LOWER_SF_BOTTOM", "WINNER"),
  },
  {
    key: "SEVENTH_PLACE",
    round: "За 7 місце",
    sideA: matchResult("LOWER_SF_TOP", "LOSER"),
    sideB: matchResult("LOWER_SF_BOTTOM", "LOSER"),
  },
];
