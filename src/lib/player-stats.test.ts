import { describe, expect, it } from "vitest";

import { summarizePlayerStats } from "@/lib/player-stats";

describe("summarizePlayerStats", () => {
  it("returns zeroed stats for a player with no matches", () => {
    expect(summarizePlayerStats("p1", [])).toEqual({
      playerId: "p1",
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: 0,
    });
  });

  it("counts a win when the player's side matches the winning side", () => {
    const rows = [{ side: "A" as const, match: { winnerSide: "A" as const } }];
    expect(summarizePlayerStats("p1", rows)).toEqual({
      playerId: "p1",
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      winPct: 100,
    });
  });

  it("counts a loss when the player's side lost", () => {
    const rows = [{ side: "B" as const, match: { winnerSide: "A" as const } }];
    expect(summarizePlayerStats("p1", rows)).toEqual({
      playerId: "p1",
      matchesPlayed: 1,
      wins: 0,
      losses: 1,
      winPct: 0,
    });
  });

  it("computes win percentage rounded to the nearest integer", () => {
    const rows = [
      { side: "A" as const, match: { winnerSide: "A" as const } },
      { side: "A" as const, match: { winnerSide: "A" as const } },
      { side: "B" as const, match: { winnerSide: "A" as const } },
    ];
    // 2 wins out of 3 = 66.67% -> rounds to 67
    expect(summarizePlayerStats("p1", rows).winPct).toBe(67);
  });
});
