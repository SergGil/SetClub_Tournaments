import { CONSOLATION_SEMIFINAL_ROUND, FINAL_ROUND, MINI_GROUP_ROUND } from "@/lib/playoff-rounds";

/** How a downstream match's side gets its player, once decided. */
export type BracketSlotSource =
  | { kind: "GROUP_RANK"; group: number; rank: 1 | 2 | 3 }
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

function groupRank(group: number, rank: 1 | 2 | 3): BracketSlotSource {
  return { kind: "GROUP_RANK", group, rank };
}

/**
 * Static topology of the 18 downstream (playerless-at-creation) matches for
 * the "4 групи по 3 + плей-офф" 12-player/4-seed SINGLES format - see
 * docs/GROUPS12_PLAYOFF.md. Groups are numbered 1=A, 2=B, 3=C, 4=D
 * (TournamentParticipant.group), matching groupRoundLabel's existing A-F
 * letter mapping in src/lib/randomize-pairs.ts.
 *
 * Purely descriptive data - no Prisma, no randomness. The commit action
 * (src/lib/actions/randomize-singles-groups12.ts) resolves each `key` to a
 * real Match id and each `sourceMatchKey` to that same id when writing
 * MatchAdvancement rows; the resolver (src/lib/bracket-advancement.ts) never
 * reads this module - it only ever consults the persisted MatchAdvancement
 * rows this plan was used to create.
 */
export const GROUPS12_PLAYOFF_BRACKET_PLAN: readonly BracketMatchPlan[] = [
  // Quarterfinals: A1-C2, C1-A2, B1-D2, D1-B2.
  { key: "QF1", round: "1/4", sideA: groupRank(1, 1), sideB: groupRank(3, 2) },
  { key: "QF2", round: "1/4", sideA: groupRank(3, 1), sideB: groupRank(1, 2) },
  { key: "QF3", round: "1/4", sideA: groupRank(2, 1), sideB: groupRank(4, 2) },
  { key: "QF4", round: "1/4", sideA: groupRank(4, 1), sideB: groupRank(2, 2) },

  // Semifinals: winners of the two QF pairs on each half.
  { key: "SF_TOP", round: "1/2", sideA: matchResult("QF1", "WINNER"), sideB: matchResult("QF2", "WINNER") },
  { key: "SF_BOTTOM", round: "1/2", sideA: matchResult("QF3", "WINNER"), sideB: matchResult("QF4", "WINNER") },

  // Final and bronze medal.
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

  // Placement bracket (5th-8th): QF losers.
  {
    key: "CONS_SF_TOP",
    round: CONSOLATION_SEMIFINAL_ROUND,
    sideA: matchResult("QF1", "LOSER"),
    sideB: matchResult("QF2", "LOSER"),
  },
  {
    key: "CONS_SF_BOTTOM",
    round: CONSOLATION_SEMIFINAL_ROUND,
    sideA: matchResult("QF3", "LOSER"),
    sideB: matchResult("QF4", "LOSER"),
  },
  {
    key: "FIFTH_PLACE",
    round: "За 5 місце",
    sideA: matchResult("CONS_SF_TOP", "WINNER"),
    sideB: matchResult("CONS_SF_BOTTOM", "WINNER"),
  },
  {
    key: "SEVENTH_PLACE",
    round: "За 7 місце",
    sideA: matchResult("CONS_SF_TOP", "LOSER"),
    sideB: matchResult("CONS_SF_BOTTOM", "LOSER"),
  },

  // Mini round robin among the four 3rd-place group finishers - decides 9-12.
  { key: "MINI_AB", round: MINI_GROUP_ROUND, sideA: groupRank(1, 3), sideB: groupRank(2, 3) },
  { key: "MINI_AC", round: MINI_GROUP_ROUND, sideA: groupRank(1, 3), sideB: groupRank(3, 3) },
  { key: "MINI_AD", round: MINI_GROUP_ROUND, sideA: groupRank(1, 3), sideB: groupRank(4, 3) },
  { key: "MINI_BC", round: MINI_GROUP_ROUND, sideA: groupRank(2, 3), sideB: groupRank(3, 3) },
  { key: "MINI_BD", round: MINI_GROUP_ROUND, sideA: groupRank(2, 3), sideB: groupRank(4, 3) },
  { key: "MINI_CD", round: MINI_GROUP_ROUND, sideA: groupRank(3, 3), sideB: groupRank(4, 3) },
];
