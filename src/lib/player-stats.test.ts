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
      gamesWon: 0,
      gamesLost: 0,
    });
  });

  it("counts a win when the player's side matches the winning side", () => {
    const rows = [{ side: "A" as const, match: { winnerSide: "A" as const, sets: [] } }];
    expect(summarizePlayerStats("p1", rows)).toEqual({
      playerId: "p1",
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      winPct: 100,
      gamesWon: 0,
      gamesLost: 0,
    });
  });

  it("counts a loss when the player's side lost", () => {
    const rows = [{ side: "B" as const, match: { winnerSide: "A" as const, sets: [] } }];
    expect(summarizePlayerStats("p1", rows)).toEqual({
      playerId: "p1",
      matchesPlayed: 1,
      wins: 0,
      losses: 1,
      winPct: 0,
      gamesWon: 0,
      gamesLost: 0,
    });
  });

  it("computes win percentage rounded to the nearest integer", () => {
    const rows = [
      { side: "A" as const, match: { winnerSide: "A" as const, sets: [] } },
      { side: "A" as const, match: { winnerSide: "A" as const, sets: [] } },
      { side: "B" as const, match: { winnerSide: "A" as const, sets: [] } },
    ];
    // 2 wins out of 3 = 66.67% -> rounds to 67
    expect(summarizePlayerStats("p1", rows).winPct).toBe(67);
  });

  it("sums games won and lost from the player's own side across all sets", () => {
    const rows = [
      {
        side: "A" as const,
        match: {
          winnerSide: "A" as const,
          sets: [
            { sideAGames: 6, sideBGames: 4 },
            { sideAGames: 6, sideBGames: 2 },
          ],
        },
      },
      {
        side: "B" as const,
        match: {
          winnerSide: "A" as const,
          sets: [{ sideAGames: 6, sideBGames: 3 }],
        },
      },
    ];
    expect(summarizePlayerStats("p1", rows)).toMatchObject({
      gamesWon: 6 + 6 + 3,
      gamesLost: 4 + 2 + 6,
    });
  });
});
