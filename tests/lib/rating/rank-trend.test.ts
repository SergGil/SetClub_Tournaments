import { describe, expect, it } from "vitest";

import { buildRankDeltaMap, excludeLatestTournament } from "@/lib/rating/rank-trend";

describe("excludeLatestTournament", () => {
  it("returns an empty array unchanged", () => {
    expect(excludeLatestTournament([])).toEqual([]);
  });

  it("drops every row belonging to the tournament with the latest start date", () => {
    const rows = [
      { tournamentId: "t1", tournamentStartDate: 100 },
      { tournamentId: "t1", tournamentStartDate: 100 },
      { tournamentId: "t2", tournamentStartDate: 200 },
      { tournamentId: "t3", tournamentStartDate: 50 },
    ];

    expect(excludeLatestTournament(rows)).toEqual([
      { tournamentId: "t1", tournamentStartDate: 100 },
      { tournamentId: "t1", tournamentStartDate: 100 },
      { tournamentId: "t3", tournamentStartDate: 50 },
    ]);
  });

  it("drops everything when every row belongs to the same (latest) tournament", () => {
    const rows = [
      { tournamentId: "t1", tournamentStartDate: 100 },
      { tournamentId: "t1", tournamentStartDate: 100 },
    ];
    expect(excludeLatestTournament(rows)).toEqual([]);
  });
});

describe("buildRankDeltaMap", () => {
  it("gives a positive delta to a player who climbed and negative to one who dropped", () => {
    const previous = ["a", "b", "c"];
    const current = ["b", "a", "c"];

    const deltas = buildRankDeltaMap(current, previous);

    expect(deltas.get("b")).toBe(1);
    expect(deltas.get("a")).toBe(-1);
    expect(deltas.get("c")).toBe(0);
  });

  it("omits a player who only just debuted (absent from the previous order)", () => {
    const deltas = buildRankDeltaMap(["a", "new-player"], ["a"]);
    expect(deltas.has("new-player")).toBe(false);
    expect(deltas.get("a")).toBe(0);
  });

  it("returns an empty map for two empty orders", () => {
    expect(buildRankDeltaMap([], [])).toEqual(new Map());
  });
});
