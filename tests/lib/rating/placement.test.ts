import { describe, expect, it } from "vitest";

import {
  fillRemainingPlacements,
  mergeSetClubPoints,
  placePoints,
  resolveDecisivePlacements,
  resolvePlacements,
} from "@/lib/rating/placement";
import type { PlayoffResult, SetClubPointsRow } from "@/lib/rating/placement";
import { recordHeadToHead } from "@/lib/standings-sort";
import type { HeadToHead, StandingsRow } from "@/lib/standings-sort";

function row(key: string, wins: number, losses: number, gamesWon = 0, gamesLost = 0): StandingsRow {
  const matchesPlayed = wins + losses;
  return {
    key,
    label: key,
    matchesPlayed,
    wins,
    losses,
    winPct: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    gamesWon,
    gamesLost,
    points: 0,
  };
}

describe("resolveDecisivePlacements", () => {
  it("resolves the winner/loser pair for every curated placement round", () => {
    const results: PlayoffResult[] = [
      { round: "Фінал", winnerKey: "p1", loserKey: "p2" },
      { round: "За 3 місце", winnerKey: "p3", loserKey: "p4" },
      { round: "За 5 місце", winnerKey: "p5", loserKey: "p6" },
      { round: "За 7 місце", winnerKey: "p7", loserKey: "p8" },
      { round: "За 9 місце", winnerKey: "p9", loserKey: "p10" },
      { round: "За 11 місце", winnerKey: "p11", loserKey: "p12" },
    ];
    const places = resolveDecisivePlacements(results);
    expect(places.get("p1")).toBe(1);
    expect(places.get("p2")).toBe(2);
    expect(places.get("p3")).toBe(3);
    expect(places.get("p4")).toBe(4);
    expect(places.get("p5")).toBe(5);
    expect(places.get("p6")).toBe(6);
    expect(places.get("p7")).toBe(7);
    expect(places.get("p8")).toBe(8);
    expect(places.get("p9")).toBe(9);
    expect(places.get("p10")).toBe(10);
    expect(places.get("p11")).toBe(11);
    expect(places.get("p12")).toBe(12);
  });

  it("ignores a round that isn't a curated placement round (a feeder stage like 1/2, or an unrecognized label)", () => {
    const results: PlayoffResult[] = [
      { round: "1/2", winnerKey: "p1", loserKey: "p2" },
      { round: "Група 1", winnerKey: "p3", loserKey: "p4" },
    ];
    expect(resolveDecisivePlacements(results).size).toBe(0);
  });

  it("only honors the first of two matches sharing the same placement round (duplicate-round defense)", () => {
    const results: PlayoffResult[] = [
      { round: "Фінал", winnerKey: "p1", loserKey: "p2" },
      { round: "Фінал", winnerKey: "p3", loserKey: "p4" },
    ];
    const places = resolveDecisivePlacements(results);
    expect(places.get("p1")).toBe(1);
    expect(places.get("p2")).toBe(2);
    expect(places.has("p3")).toBe(false);
    expect(places.has("p4")).toBe(false);
  });
});

describe("fillRemainingPlacements", () => {
  it("fills every place with no decided places yet, ranked by wins", () => {
    const rows = new Map([
      ["p1", row("p1", 2, 0)],
      ["p2", row("p2", 1, 1)],
      ["p3", row("p3", 0, 2)],
    ]);
    const placeByKey = new Map<string, number>();
    fillRemainingPlacements(["p1", "p2", "p3"], rows, new Map(), placeByKey);
    expect(placeByKey.get("p1")).toBe(1);
    expect(placeByKey.get("p2")).toBe(2);
    expect(placeByKey.get("p3")).toBe(3);
  });

  it("does not touch a place that's already decided, and fills gaps (non-contiguous) with the rest", () => {
    const rows = new Map([
      ["p1", row("p1", 3, 0)],
      ["p2", row("p2", 2, 1)],
      ["p3", row("p3", 1, 2)],
      ["p4", row("p4", 0, 3)],
    ]);
    // Places 1 and 3 already decided by a playoff (e.g. Фінал + За 5, leaving
    // 2 and 4 to fill) - deliberately non-contiguous.
    const placeByKey = new Map([
      ["p1", 1],
      ["p3", 3],
    ]);
    fillRemainingPlacements(["p1", "p2", "p3", "p4"], rows, new Map(), placeByKey);
    expect(placeByKey.get("p1")).toBe(1);
    expect(placeByKey.get("p3")).toBe(3);
    // p2 outranks p4 by record, so it takes the better of the two remaining
    // places (2), leaving p4 the last one (4).
    expect(placeByKey.get("p2")).toBe(2);
    expect(placeByKey.get("p4")).toBe(4);
  });

  it("uses head-to-head to break a tie between exactly two remaining rows", () => {
    const rows = new Map([
      ["p1", row("p1", 1, 1)],
      ["p2", row("p2", 1, 1)],
    ]);
    const h2h: HeadToHead = new Map();
    recordHeadToHead(h2h, "p1", "p2"); // p1 beat p2 head-to-head, same overall record
    const placeByKey = new Map<string, number>();
    fillRemainingPlacements(["p1", "p2"], rows, h2h, placeByKey);
    expect(placeByKey.get("p1")).toBe(1);
    expect(placeByKey.get("p2")).toBe(2);
  });
});

describe("resolvePlacements", () => {
  it("lets a playoff result override what round-robin order alone would have said, then fills the rest", () => {
    // By record alone p4 (2-0) would rank above p1 (0-1) - the Фінал result
    // below flips that entirely for places 1/2, leaving p3 to fall back to
    // round-robin order for place 3 (there's only one place left for one row).
    const rows = new Map([
      ["p1", row("p1", 0, 1)],
      ["p2", row("p2", 1, 1)],
      ["p3", row("p3", 1, 0)],
    ]);
    const playoffResults: PlayoffResult[] = [{ round: "Фінал", winnerKey: "p1", loserKey: "p2" }];
    const places = resolvePlacements(["p1", "p2", "p3"], rows, new Map(), playoffResults);
    expect(places.get("p1")).toBe(1);
    expect(places.get("p2")).toBe(2);
    expect(places.get("p3")).toBe(3);
  });

  it("ranks purely by round-robin standings when there's no playoff at all", () => {
    const rows = new Map([
      ["p1", row("p1", 2, 0)],
      ["p2", row("p2", 1, 1)],
      ["p3", row("p3", 0, 2)],
    ]);
    const places = resolvePlacements(["p1", "p2", "p3"], rows, new Map(), []);
    expect(places.get("p1")).toBe(1);
    expect(places.get("p2")).toBe(2);
    expect(places.get("p3")).toBe(3);
  });
});

describe("placePoints", () => {
  it("follows the 2*(total-place+1) ladder", () => {
    expect(placePoints(1, 6)).toBe(12);
    expect(placePoints(2, 6)).toBe(10);
    expect(placePoints(6, 6)).toBe(2);
    expect(placePoints(1, 4)).toBe(8);
    expect(placePoints(4, 4)).toBe(2);
  });

  it("clamps at 0 for a place beyond the field size (mislabeled placement round)", () => {
    expect(placePoints(11, 4)).toBe(0);
    expect(placePoints(100, 4)).toBe(0);
  });
});

describe("mergeSetClubPoints", () => {
  function points(playerId: string, points: number, tournamentsPlayed = 1): SetClubPointsRow {
    return { playerId, points, tournamentsPlayed };
  }

  it("sums points/tournamentsPlayed for a player who appears in more than one list (e.g. plays both Tennis and Padel)", () => {
    const tennis = [points("p1", 10, 2), points("p2", 4, 1)];
    const padel = [points("p1", 6, 1), points("p3", 8, 1)];
    const merged = mergeSetClubPoints(tennis, padel);
    expect(merged.find((r) => r.playerId === "p1")).toEqual({ playerId: "p1", points: 16, tournamentsPlayed: 3 });
    expect(merged.find((r) => r.playerId === "p2")).toEqual({ playerId: "p2", points: 4, tournamentsPlayed: 1 });
    expect(merged.find((r) => r.playerId === "p3")).toEqual({ playerId: "p3", points: 8, tournamentsPlayed: 1 });
  });

  it("sorts the result points-desc, same order sortSetClubPoints already returns each input in", () => {
    const merged = mergeSetClubPoints([points("low", 2), points("high", 20)], [points("mid", 10)]);
    expect(merged.map((r) => r.playerId)).toEqual(["high", "mid", "low"]);
  });

  it("does not mutate its inputs", () => {
    const tennis = [points("p1", 10)];
    const padel = [points("p1", 6)];
    mergeSetClubPoints(tennis, padel);
    expect(tennis[0].points).toBe(10);
    expect(padel[0].points).toBe(6);
  });

  it("returns an empty list when every input is empty", () => {
    expect(mergeSetClubPoints([], [])).toEqual([]);
  });

  it("works with a single list (no merging needed)", () => {
    const only = [points("p1", 4), points("p2", 8)];
    expect(mergeSetClubPoints(only).map((r) => r.playerId)).toEqual(["p2", "p1"]);
  });
});
