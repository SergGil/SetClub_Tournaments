import { describe, expect, it } from "vitest";

import { buildRankDeltaMap, buildRankedDeltaMap, excludeLatestTournament } from "@/lib/rating/rank-trend";

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

describe("buildRankedDeltaMap", () => {
  const MIN = 10;
  const row = (playerId: string, matchesPlayed: number) => ({ playerId, matchesPlayed });

  it("counts a drop only across numbered players - provisional ones sorted in between don't inflate it", () => {
    // The real case behind this function: a player falls from #2 to #3 among
    // numbered players, but in the full order three provisional (3-match)
    // players who didn't play the latest tournament now sit above him too.
    const previous = [row("top", 50), row("max", 23), row("p1", 3), row("p2", 3), row("p3", 4), row("mid", 30)];
    const current = [row("top", 51), row("p1", 3), row("p2", 3), row("p3", 4), row("mid", 31), row("max", 26)];

    // The full-order delta would be 1 - 5 = -4 ("▼4") for a table that shows #2 -> #3.
    expect(buildRankDeltaMap(current.map((r) => r.playerId), previous.map((r) => r.playerId)).get("max")).toBe(-4);

    const deltas = buildRankedDeltaMap(current, previous, MIN);
    expect(deltas.get("max")).toBe(-1);
    expect(deltas.get("mid")).toBe(1);
    expect(deltas.get("top")).toBe(0);
  });

  it("gives no entry to a provisional player, even one who played both times", () => {
    const deltas = buildRankedDeltaMap([row("a", 20), row("p", 4)], [row("p", 3), row("a", 19)], MIN);
    expect(deltas.has("p")).toBe(false);
    expect(deltas.get("a")).toBe(0);
  });

  it("gives no entry to a player who only just crossed the threshold - they had no numbered place before", () => {
    // 9 matches before the latest tournament, 10 after: newly numbered, like a debut.
    const deltas = buildRankedDeltaMap([row("new", 10), row("a", 20)], [row("a", 19), row("new", 9)], MIN);
    expect(deltas.has("new")).toBe(false);
    expect(deltas.get("a")).toBe(-1);
  });

  it("reads each order's own matchesPlayed - the previous counts are as of before the latest tournament", () => {
    // Same player, numbered in both orders only because each order's own count clears the bar.
    const deltas = buildRankedDeltaMap([row("a", 12), row("b", 11)], [row("b", 10), row("a", 10)], MIN);
    expect(deltas.get("a")).toBe(1);
    expect(deltas.get("b")).toBe(-1);
  });
});
