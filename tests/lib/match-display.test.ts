import { describe, expect, it } from "vitest";

import { emptySlotLabel } from "@/lib/match-display";
import type { MatchAdvancementInfo } from "@/lib/match-display";

function groupRank(sourceGroup: number, sourceRank: number): MatchAdvancementInfo {
  return { side: "A", source: "GROUP_RANK", sourceGroup, sourceRank, outcome: null, sourceMatch: null };
}

function matchResult(outcome: "WINNER" | "LOSER", round: string | null): MatchAdvancementInfo {
  return {
    side: "A",
    source: "MATCH_RESULT",
    sourceGroup: null,
    sourceRank: null,
    outcome,
    sourceMatch: round ? { round } : null,
  };
}

describe("emptySlotLabel", () => {
  it("labels rank 1 as the group's winner", () => {
    expect(emptySlotLabel(groupRank(1, 1))).toBe("Переможець Групи A");
    expect(emptySlotLabel(groupRank(2, 1))).toBe("Переможець Групи B");
  });

  it("labels ranks 2-4 with an ordinal place", () => {
    expect(emptySlotLabel(groupRank(1, 2))).toBe("2-ге місце Групи A");
    expect(emptySlotLabel(groupRank(1, 3))).toBe("3-тє місце Групи A");
    expect(emptySlotLabel(groupRank(1, 4))).toBe("4-те місце Групи A");
  });

  it("labels a MATCH_RESULT winner slot by the source match's round", () => {
    expect(emptySlotLabel(matchResult("WINNER", "1/2"))).toBe("Переможець 1/2");
  });

  it("labels a MATCH_RESULT loser slot by the source match's round", () => {
    expect(emptySlotLabel(matchResult("LOSER", "1/2"))).toBe("Той, хто програв 1/2");
  });

  it("normalizes a legacy round spelling in the source match's round", () => {
    expect(emptySlotLabel(matchResult("WINNER", "Група 1"))).toBe("Переможець Група A");
  });

  it("falls back to a generic phrase when the source match's round is missing", () => {
    expect(emptySlotLabel(matchResult("WINNER", null))).toBe("Переможець попереднього матчу");
    expect(emptySlotLabel(matchResult("LOSER", null))).toBe("Той, хто програв попереднього матчу");
  });
});
