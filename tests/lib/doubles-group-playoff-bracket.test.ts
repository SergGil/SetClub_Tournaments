import { describe, expect, it } from "vitest";

import { DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN } from "@/lib/doubles-group-playoff-bracket";
import { LOWER_SEMIFINAL_ROUND } from "@/lib/playoff-rounds";

describe("DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN", () => {
  it("has exactly 8 entries with unique keys", () => {
    expect(DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN).toHaveLength(8);
    const keys = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((p) => p.key);
    expect(new Set(keys).size).toBe(8);
  });

  it("every MATCH_RESULT sourceMatchKey resolves to another entry's key, with no self-reference", () => {
    const keys = new Set(DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((p) => p.key));
    for (const plan of DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN) {
      for (const side of [plan.sideA, plan.sideB]) {
        if (side.kind !== "MATCH_RESULT") continue;
        expect(keys.has(side.sourceMatchKey)).toBe(true);
        expect(side.sourceMatchKey).not.toBe(plan.key);
      }
    }
  });

  it("has no cycles in the MATCH_RESULT dependency graph", () => {
    const byKey = new Map(DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    for (const plan of DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN) {
      const visited = new Set<string>();
      const stack = [plan.key];
      while (stack.length > 0) {
        const key = stack.pop()!;
        if (visited.has(key)) continue;
        visited.add(key);
        const node = byKey.get(key);
        if (!node) continue;
        for (const side of [node.sideA, node.sideB]) {
          if (side.kind === "MATCH_RESULT") {
            expect(side.sourceMatchKey).not.toBe(plan.key);
            stack.push(side.sourceMatchKey);
          }
        }
      }
    }
  });

  it("wires the upper semifinals exactly as A1-B2, A2-B1 (1=A, 2=B)", () => {
    const byKey = new Map(DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    const rank = (side: (typeof DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN)[number]["sideA"]) =>
      side.kind === "GROUP_RANK" ? `${side.group}.${side.rank}` : null;

    expect([rank(byKey.get("SF_TOP")!.sideA), rank(byKey.get("SF_TOP")!.sideB)]).toEqual(["1.1", "2.2"]);
    expect([rank(byKey.get("SF_BOTTOM")!.sideA), rank(byKey.get("SF_BOTTOM")!.sideB)]).toEqual(["2.1", "1.2"]);
  });

  it("wires the lower semifinals exactly as A3-B4, A4-B3", () => {
    const byKey = new Map(DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    const rank = (side: (typeof DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN)[number]["sideA"]) =>
      side.kind === "GROUP_RANK" ? `${side.group}.${side.rank}` : null;

    expect([rank(byKey.get("LOWER_SF_TOP")!.sideA), rank(byKey.get("LOWER_SF_TOP")!.sideB)]).toEqual(["1.3", "2.4"]);
    expect([rank(byKey.get("LOWER_SF_BOTTOM")!.sideA), rank(byKey.get("LOWER_SF_BOTTOM")!.sideB)]).toEqual([
      "2.3",
      "1.4",
    ]);
  });

  it("has exactly 2 lower semifinals feeding За 5/За 7 місце", () => {
    const lowerSf = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === LOWER_SEMIFINAL_ROUND);
    expect(lowerSf).toHaveLength(2);
    const fifthPlace = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.find((p) => p.key === "FIFTH_PLACE")!;
    const seventhPlace = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.find((p) => p.key === "SEVENTH_PLACE")!;
    expect(fifthPlace.round).toBe("За 5 місце");
    expect(seventhPlace.round).toBe("За 7 місце");
    for (const side of [fifthPlace.sideA, fifthPlace.sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("WINNER");
    }
    for (const side of [seventhPlace.sideA, seventhPlace.sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("LOSER");
    }
  });

  it("has exactly one Фінал and one За 3 місце, fed by the two upper semifinals' winners/losers", () => {
    const finals = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === "Фінал");
    const thirds = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === "За 3 місце");
    expect(finals).toHaveLength(1);
    expect(thirds).toHaveLength(1);
    for (const side of [finals[0].sideA, finals[0].sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("WINNER");
    }
    for (const side of [thirds[0].sideA, thirds[0].sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("LOSER");
    }
  });

  it("has exactly one 1/2 pair (upper bracket only) - LOWER_SEMIFINAL_ROUND is a distinct label", () => {
    const upperSf = DOUBLES_GROUP_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === "1/2");
    expect(upperSf).toHaveLength(2);
    expect(upperSf.map((p) => p.key).sort()).toEqual(["SF_BOTTOM", "SF_TOP"]);
  });
});
