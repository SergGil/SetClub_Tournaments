import { describe, expect, it } from "vitest";

import {
  computeDoublesRatings,
  computeDoublesRatingsWithHistory,
  computeSinglesRatings,
  computeSinglesRatingsWithHistory,
} from "./engine";
import type { RatingMatchRow } from "./engine";
import { GLICKO2_DEFAULT } from "./glicko2";
import { OPENSKILL_DEFAULT } from "./openskill";

function singlesMatch(
  id: string,
  tournamentId: string,
  tournamentStartDate: number,
  winnerId: string,
  loserId: string,
  sets: { sideAGames: number; sideBGames: number }[] = [
    { sideAGames: 6, sideBGames: 0 },
    { sideAGames: 6, sideBGames: 0 },
  ],
): RatingMatchRow {
  return {
    id,
    tournamentId,
    tournamentStartDate,
    winnerSide: "A",
    createdAt: tournamentStartDate,
    round: null,
    tournamentParticipantCount: 2,
    players: [
      { side: "A", playerId: winnerId, seeded: false },
      { side: "B", playerId: loserId, seeded: false },
    ],
    sets,
  };
}

describe("computeSinglesRatings", () => {
  it("raises the winner's rating and lowers the loser's", () => {
    const t1 = new Date("2026-01-01").getTime();
    const rows = [singlesMatch("m1", "t1", t1, "p1", "p2")];

    const result = computeSinglesRatings(rows);
    expect(result.get("p1")!.rating.rating).toBeGreaterThan(GLICKO2_DEFAULT.rating);
    expect(result.get("p2")!.rating.rating).toBeLessThan(GLICKO2_DEFAULT.rating);
    expect(result.get("p1")!.matchesPlayed).toBe(1);
  });

  it("only inflates RD for a player who sits out a tournament they'd previously played", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [
      singlesMatch("m1", "t1", t1, "p1", "p2"),
      singlesMatch("m2", "t2", t2, "p1", "p3"), // p2 sits out t2
    ];

    const afterT1Only = computeSinglesRatings([rows[0]]);
    const final = computeSinglesRatings(rows);

    const p2AfterT1 = afterT1Only.get("p2")!.rating;
    const p2Final = final.get("p2")!.rating;
    expect(p2Final.rating).toBe(p2AfterT1.rating);
    expect(p2Final.volatility).toBe(p2AfterT1.volatility);
    expect(p2Final.rd).toBeGreaterThan(p2AfterT1.rd);
    // Sitting out a period doesn't count as a played match.
    expect(final.get("p2")!.matchesPlayed).toBe(1);
  });

  it("processes tournaments in start-date order regardless of input array order", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [singlesMatch("m1", "t1", t1, "p1", "p2"), singlesMatch("m2", "t2", t2, "p2", "p3")];

    const forward = computeSinglesRatings(rows);
    const backward = computeSinglesRatings([...rows].reverse());
    expect(forward.get("p2")!.rating).toEqual(backward.get("p2")!.rating);
  });
});

function doublesMatch(
  id: string,
  tournamentId: string,
  tournamentStartDate: number,
  createdAt: number,
  winningTeam: [string, string],
  losingTeam: [string, string],
  sets: { sideAGames: number; sideBGames: number }[] = [
    { sideAGames: 6, sideBGames: 0 },
    { sideAGames: 6, sideBGames: 0 },
  ],
  seededWinning: [boolean, boolean] = [false, false],
  seededLosing: [boolean, boolean] = [false, false],
): RatingMatchRow {
  return {
    id,
    tournamentId,
    tournamentStartDate,
    winnerSide: "A",
    createdAt,
    round: null,
    tournamentParticipantCount: 4,
    players: [
      { side: "A", playerId: winningTeam[0], seeded: seededWinning[0] },
      { side: "A", playerId: winningTeam[1], seeded: seededWinning[1] },
      { side: "B", playerId: losingTeam[0], seeded: seededLosing[0] },
      { side: "B", playerId: losingTeam[1], seeded: seededLosing[1] },
    ],
    sets,
  };
}

describe("computeDoublesRatings", () => {
  it("raises the winning team's rating and lowers the losing team's", () => {
    const t1 = new Date("2026-01-01").getTime();
    const rows = [doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"])];

    const result = computeDoublesRatings(rows);
    expect(result.get("p1")!.rating.mu).toBeGreaterThan(OPENSKILL_DEFAULT.mu);
    expect(result.get("p3")!.rating.mu).toBeLessThan(OPENSKILL_DEFAULT.mu);
    expect(result.get("p1")!.rating.mu).toBeCloseTo(result.get("p2")!.rating.mu, 8);
    expect(result.get("p1")!.matchesPlayed).toBe(1);
  });

  it("gives the seeded player a bigger share of the rating change than their unseeded partner", () => {
    const t1 = new Date("2026-01-01").getTime();
    const sets = [
      { sideAGames: 6, sideBGames: 0 },
      { sideAGames: 6, sideBGames: 0 },
    ];
    const rows = [
      doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"], sets, [true, false]),
    ];

    const result = computeDoublesRatings(rows);
    const deltaSeeded = result.get("p1")!.rating.mu - OPENSKILL_DEFAULT.mu;
    const deltaUnseeded = result.get("p2")!.rating.mu - OPENSKILL_DEFAULT.mu;
    expect(deltaSeeded).toBeGreaterThan(deltaUnseeded);
  });

  it("processes same-period matches in a deterministic order regardless of input array order", () => {
    const t1 = new Date("2026-01-01").getTime();
    const rows = [
      doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"]),
      doublesMatch("m2", "t1", t1, t1, ["p1", "p3"], ["p2", "p4"]),
    ];

    const forward = computeDoublesRatings(rows);
    const backward = computeDoublesRatings([...rows].reverse());
    expect(forward.get("p1")!.rating).toEqual(backward.get("p1")!.rating);
    expect(forward.get("p4")!.rating).toEqual(backward.get("p4")!.rating);
  });
});

describe("computeSinglesRatingsWithHistory", () => {
  it("returns the same final ratings as computeSinglesRatings", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [singlesMatch("m1", "t1", t1, "p1", "p2"), singlesMatch("m2", "t2", t2, "p1", "p3")];

    const { final } = computeSinglesRatingsWithHistory(rows);
    expect(final).toEqual(computeSinglesRatings(rows));
  });

  it("emits one snapshot per player per tournament, matching a partial replay", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [singlesMatch("m1", "t1", t1, "p1", "p2"), singlesMatch("m2", "t2", t2, "p1", "p3")];

    const { snapshots } = computeSinglesRatingsWithHistory(rows);
    const afterT1 = computeSinglesRatings([rows[0]]);
    const afterT2 = computeSinglesRatings(rows);

    const p1AtT1 = snapshots.find((s) => s.playerId === "p1" && s.tournamentId === "t1")!;
    expect(p1AtT1.rating).toEqual(afterT1.get("p1")!.rating);
    expect(p1AtT1.asOfDate).toBe(t1);

    const p1AtT2 = snapshots.find((s) => s.playerId === "p1" && s.tournamentId === "t2")!;
    expect(p1AtT2.rating).toEqual(afterT2.get("p1")!.rating);
  });

  it("still snapshots a player who sits out a later tournament (RD-inflated, not dropped)", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [singlesMatch("m1", "t1", t1, "p1", "p2"), singlesMatch("m2", "t2", t2, "p1", "p3")];

    const { snapshots } = computeSinglesRatingsWithHistory(rows);
    const p2AtT2 = snapshots.find((s) => s.playerId === "p2" && s.tournamentId === "t2");
    expect(p2AtT2).toBeDefined();
    const p2AtT1 = snapshots.find((s) => s.playerId === "p2" && s.tournamentId === "t1")!;
    expect(p2AtT2!.rating.rd).toBeGreaterThan(p2AtT1.rating.rd);
  });
});

describe("computeDoublesRatingsWithHistory", () => {
  it("returns the same final ratings as computeDoublesRatings", () => {
    const t1 = new Date("2026-01-01").getTime();
    const rows = [doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"])];

    const { final } = computeDoublesRatingsWithHistory(rows);
    expect(final).toEqual(computeDoublesRatings(rows));
  });

  it("emits one snapshot per player per tournament, matching a partial replay", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [
      doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"]),
      doublesMatch("m2", "t2", t2, t2, ["p1", "p2"], ["p3", "p4"]),
    ];

    const { snapshots } = computeDoublesRatingsWithHistory(rows);
    const afterT1 = computeDoublesRatings([rows[0]]);
    const afterT2 = computeDoublesRatings(rows);

    const p1AtT1 = snapshots.find((s) => s.playerId === "p1" && s.tournamentId === "t1")!;
    expect(p1AtT1.rating).toEqual(afterT1.get("p1")!.rating);
    const p1AtT2 = snapshots.find((s) => s.playerId === "p1" && s.tournamentId === "t2")!;
    expect(p1AtT2.rating).toEqual(afterT2.get("p1")!.rating);
  });

  it("carries a sat-out player's unchanged rating into the next tournament's snapshot", () => {
    const t1 = new Date("2026-01-01").getTime();
    const t2 = new Date("2026-02-01").getTime();
    const rows = [
      doublesMatch("m1", "t1", t1, t1, ["p1", "p2"], ["p3", "p4"]),
      doublesMatch("m2", "t2", t2, t2, ["p1", "p5"], ["p6", "p7"]), // p2/p3/p4 sit out
    ];

    const { snapshots } = computeDoublesRatingsWithHistory(rows);
    const p2AtT1 = snapshots.find((s) => s.playerId === "p2" && s.tournamentId === "t1")!;
    const p2AtT2 = snapshots.find((s) => s.playerId === "p2" && s.tournamentId === "t2")!;
    expect(p2AtT2.rating).toEqual(p2AtT1.rating);
  });

  it("emits exactly one snapshot per player per tournament even when same-dated tournaments' matches interleave", () => {
    // Three tournaments-worth of rows sharing one startDate, alternating
    // t2/t1/t2 by createdAt - a flat sort tie-breaking on createdAt/id would
    // process them in exactly this interleaved order and "close" t2 twice
    // (once when the order moves to t1, again at the end), instead of once
    // per tournament like grouping-by-id-first guarantees.
    const sameDate = new Date("2026-03-01").getTime();
    const rows = [
      doublesMatch("m-t2-a", "t2", sameDate, sameDate, ["p1", "p2"], ["p3", "p4"]),
      doublesMatch("m-t1-a", "t1", sameDate, sameDate + 1000, ["p1", "p2"], ["p3", "p4"]),
      doublesMatch("m-t2-b", "t2", sameDate, sameDate + 2000, ["p1", "p2"], ["p3", "p4"]),
    ];

    const { snapshots } = computeDoublesRatingsWithHistory(rows);
    const byTournament = new Map<string, number>();
    for (const s of snapshots) {
      if (s.playerId !== "p1") continue;
      byTournament.set(s.tournamentId, (byTournament.get(s.tournamentId) ?? 0) + 1);
    }
    expect(byTournament.get("t1")).toBe(1);
    expect(byTournament.get("t2")).toBe(1);
  });
});
