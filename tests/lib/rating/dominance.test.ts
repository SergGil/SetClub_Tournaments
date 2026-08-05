import { describe, expect, it } from "vitest";

import { computeDominance, DEFAULT_DOMINANCE_NO_GAMES } from "@/lib/rating/dominance";

describe("computeDominance", () => {
  it("returns 1.0 for a shutout", () => {
    expect(computeDominance([{ sideAGames: 6, sideBGames: 0 }], "A")).toBe(1);
  });

  it("returns a value close to 0.5 for a single-set squeaker", () => {
    const dominance = computeDominance([{ sideAGames: 7, sideBGames: 6 }], "A");
    expect(dominance).toBeCloseTo(7 / 13, 5);
  });

  it("clamps to 0.5 when the winner has fewer aggregate games than the loser", () => {
    const sets = [
      { sideAGames: 7, sideBGames: 6 },
      { sideAGames: 0, sideBGames: 6 },
      { sideAGames: 7, sideBGames: 6 },
    ];
    // Side A wins the match (2 sets to 1) but only 14 total games vs 18.
    expect(computeDominance(sets, "A")).toBe(0.5);
  });

  it("uses the neutral fallback for a zero-game retirement", () => {
    expect(computeDominance([], "A")).toBe(DEFAULT_DOMINANCE_NO_GAMES);
    expect(computeDominance([{ sideAGames: 0, sideBGames: 0 }], "B")).toBe(DEFAULT_DOMINANCE_NO_GAMES);
  });

  it("is always within [0.5, 1]", () => {
    const cases: { sideAGames: number; sideBGames: number }[][] = [
      [{ sideAGames: 6, sideBGames: 4 }, { sideAGames: 6, sideBGames: 3 }],
      [{ sideAGames: 1, sideBGames: 6 }, { sideAGames: 7, sideBGames: 6 }],
    ];
    for (const sets of cases) {
      for (const winnerSide of ["A", "B"] as const) {
        const dominance = computeDominance(sets, winnerSide);
        expect(dominance).toBeGreaterThanOrEqual(0.5);
        expect(dominance).toBeLessThanOrEqual(1);
      }
    }
  });
});
