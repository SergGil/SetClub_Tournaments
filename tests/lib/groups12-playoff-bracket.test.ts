import { describe, expect, it } from "vitest";

import { GROUPS12_PLAYOFF_BRACKET_PLAN } from "@/lib/groups12-playoff-bracket";
import { CONSOLATION_SEMIFINAL_ROUND, MINI_GROUP_ROUND } from "@/lib/playoff-rounds";

describe("GROUPS12_PLAYOFF_BRACKET_PLAN", () => {
  it("has exactly 18 entries with unique keys", () => {
    expect(GROUPS12_PLAYOFF_BRACKET_PLAN).toHaveLength(18);
    const keys = GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => p.key);
    expect(new Set(keys).size).toBe(18);
  });

  it("every MATCH_RESULT sourceMatchKey resolves to another entry's key, with no self-reference", () => {
    const keys = new Set(GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => p.key));
    for (const plan of GROUPS12_PLAYOFF_BRACKET_PLAN) {
      for (const side of [plan.sideA, plan.sideB]) {
        if (side.kind !== "MATCH_RESULT") continue;
        expect(keys.has(side.sourceMatchKey)).toBe(true);
        expect(side.sourceMatchKey).not.toBe(plan.key);
      }
    }
  });

  it("has no cycles in the MATCH_RESULT dependency graph", () => {
    const byKey = new Map(GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    for (const plan of GROUPS12_PLAYOFF_BRACKET_PLAN) {
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

  it("wires the quarterfinals exactly as A1-C2, C1-A2, B1-D2, D1-B2 (1=A, 2=B, 3=C, 4=D)", () => {
    const byKey = new Map(GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    const rank = (side: (typeof GROUPS12_PLAYOFF_BRACKET_PLAN)[number]["sideA"]) =>
      side.kind === "GROUP_RANK" ? `${side.group}.${side.rank}` : null;

    expect([rank(byKey.get("QF1")!.sideA), rank(byKey.get("QF1")!.sideB)]).toEqual(["1.1", "3.2"]);
    expect([rank(byKey.get("QF2")!.sideA), rank(byKey.get("QF2")!.sideB)]).toEqual(["3.1", "1.2"]);
    expect([rank(byKey.get("QF3")!.sideA), rank(byKey.get("QF3")!.sideB)]).toEqual(["2.1", "4.2"]);
    expect([rank(byKey.get("QF4")!.sideA), rank(byKey.get("QF4")!.sideB)]).toEqual(["4.1", "2.2"]);
  });

  it("never pairs two players of the same group before the final-equivalent matches (Фінал / За 3 / За 5 / За 7 місце)", () => {
    const byKey = new Map(GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    type Slot = (typeof GROUPS12_PLAYOFF_BRACKET_PLAN)[number]["sideA"];
    // Every group whose player could possibly end up in this slot, over all outcomes of the matches feeding it.
    const possibleGroups = (slot: Slot): Set<number> => {
      if (slot.kind === "GROUP_RANK") return new Set([slot.group]);
      const source = byKey.get(slot.sourceMatchKey)!;
      return new Set([...possibleGroups(source.sideA), ...possibleGroups(source.sideB)]);
    };
    const lastMatchOfASubBracket = new Set(["FINAL", "THIRD_PLACE", "FIFTH_PLACE", "SEVENTH_PLACE"]);

    const playoff = GROUPS12_PLAYOFF_BRACKET_PLAN.filter((p) => p.round !== MINI_GROUP_ROUND);
    for (const plan of playoff) {
      if (lastMatchOfASubBracket.has(plan.key)) continue;
      const a = possibleGroups(plan.sideA);
      const b = possibleGroups(plan.sideB);
      const shared = [...a].filter((group) => b.has(group));
      expect(shared, `${plan.key} could pair two players of group(s) ${shared.join(",")}`).toEqual([]);
    }
  });

  it("puts the two semifinals' winners from opposite halves into the final, so every group-mate pair can only meet there", () => {
    const byKey = new Map(GROUPS12_PLAYOFF_BRACKET_PLAN.map((p) => [p.key, p]));
    const source = (key: string, side: "sideA" | "sideB") => {
      const slot = byKey.get(key)![side];
      return slot.kind === "MATCH_RESULT" ? `${slot.sourceMatchKey}:${slot.outcome}` : null;
    };
    expect([source("SF_TOP", "sideA"), source("SF_TOP", "sideB")]).toEqual(["QF1:WINNER", "QF3:WINNER"]);
    expect([source("SF_BOTTOM", "sideA"), source("SF_BOTTOM", "sideB")]).toEqual(["QF2:WINNER", "QF4:WINNER"]);
    expect([source("CONS_SF_TOP", "sideA"), source("CONS_SF_TOP", "sideB")]).toEqual(["QF1:LOSER", "QF3:LOSER"]);
    expect([source("CONS_SF_BOTTOM", "sideA"), source("CONS_SF_BOTTOM", "sideB")]).toEqual(["QF2:LOSER", "QF4:LOSER"]);
  });

  it("has exactly 6 mini-group matches, one per pair of the four 3rd-place finishers", () => {
    const miniGroup = GROUPS12_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === MINI_GROUP_ROUND);
    expect(miniGroup).toHaveLength(6);
    const pairs = miniGroup.map((p) => {
      const a = p.sideA.kind === "GROUP_RANK" ? p.sideA.group : null;
      const b = p.sideB.kind === "GROUP_RANK" ? p.sideB.group : null;
      expect(p.sideA.kind).toBe("GROUP_RANK");
      expect(p.sideB.kind).toBe("GROUP_RANK");
      if (p.sideA.kind === "GROUP_RANK") expect(p.sideA.rank).toBe(3);
      if (p.sideB.kind === "GROUP_RANK") expect(p.sideB.rank).toBe(3);
      return [a, b].sort().join("-");
    });
    expect(new Set(pairs).size).toBe(6); // every group pair (1-2,1-3,1-4,2-3,2-4,3-4) appears exactly once
  });

  it("has exactly 2 consolation semifinals feeding За 5/За 7 місце", () => {
    const consSf = GROUPS12_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === CONSOLATION_SEMIFINAL_ROUND);
    expect(consSf).toHaveLength(2);
    const fifthPlace = GROUPS12_PLAYOFF_BRACKET_PLAN.find((p) => p.key === "FIFTH_PLACE")!;
    const seventhPlace = GROUPS12_PLAYOFF_BRACKET_PLAN.find((p) => p.key === "SEVENTH_PLACE")!;
    expect(fifthPlace.round).toBe("За 5 місце");
    expect(seventhPlace.round).toBe("За 7 місце");
    for (const side of [fifthPlace.sideA, fifthPlace.sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("WINNER");
    }
    for (const side of [seventhPlace.sideA, seventhPlace.sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("LOSER");
    }
  });

  it("has exactly one Фінал and one За 3 місце, fed by the two semifinals' winners/losers", () => {
    const finals = GROUPS12_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === "Фінал");
    const thirds = GROUPS12_PLAYOFF_BRACKET_PLAN.filter((p) => p.round === "За 3 місце");
    expect(finals).toHaveLength(1);
    expect(thirds).toHaveLength(1);
    for (const side of [finals[0].sideA, finals[0].sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("WINNER");
    }
    for (const side of [thirds[0].sideA, thirds[0].sideB]) {
      expect(side.kind === "MATCH_RESULT" && side.outcome).toBe("LOSER");
    }
  });
});
