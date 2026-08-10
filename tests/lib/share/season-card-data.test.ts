import { describe, expect, it } from "vitest";

import { buildSeasonShareData } from "@/lib/share/season-card-data";

const nameById = new Map([
  ["p1", "Іван"],
  ["p2", "Петро"],
]);

describe("buildSeasonShareData", () => {
  it("returns null when the year has no decided matches", () => {
    expect(buildSeasonShareData(2026, 0, 0, [], [], nameById)).toBeNull();
  });

  it("picks the season leader (index 0) of each format", () => {
    const singlesPoints = [
      { playerId: "p1", points: 42, tournamentsPlayed: 5 },
      { playerId: "p2", points: 30, tournamentsPlayed: 4 },
    ];
    const doublesPoints = [{ playerId: "p2", points: 20, tournamentsPlayed: 3 }];

    expect(buildSeasonShareData(2026, 50, 6, singlesPoints, doublesPoints, nameById)).toEqual({
      year: 2026,
      matchesPlayed: 50,
      tournamentsCompleted: 6,
      topSingles: { name: "Іван", points: 42 },
      topDoubles: { name: "Петро", points: 20 },
    });
  });

  it("leaves a format's top entry null when that format has no points rows", () => {
    const singlesPoints = [{ playerId: "p1", points: 10, tournamentsPlayed: 2 }];
    const data = buildSeasonShareData(2026, 10, 2, singlesPoints, [], nameById);
    expect(data?.topSingles).toEqual({ name: "Іван", points: 10 });
    expect(data?.topDoubles).toBeNull();
  });

  it("leaves the top entry null if the leader's name can't be resolved (defensive)", () => {
    const singlesPoints = [{ playerId: "unknown", points: 10, tournamentsPlayed: 2 }];
    const data = buildSeasonShareData(2026, 10, 2, singlesPoints, [], nameById);
    expect(data?.topSingles).toBeNull();
  });
});
