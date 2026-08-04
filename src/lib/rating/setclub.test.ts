import { describe, expect, it } from "vitest";

import { computeDoublesSetClubPoints } from "./setclub";
import type { RatingMatchRow } from "./engine";

type Player = { id: string; seeded?: boolean };

let nextId = 0;

function match(
  tournamentId: string,
  sideA: Player[],
  sideB: Player[],
  winnerSide: "A" | "B",
  options: { round?: string | null; gamesA?: number; gamesB?: number } = {},
): RatingMatchRow {
  nextId += 1;
  return {
    id: `m${nextId}`,
    tournamentId,
    tournamentStartDate: 0,
    winnerSide,
    createdAt: nextId,
    round: options.round ?? null,
    tournamentParticipantCount: sideA.length + sideB.length,
    players: [
      ...sideA.map((p) => ({ side: "A" as const, playerId: p.id, seeded: p.seeded ?? false })),
      ...sideB.map((p) => ({ side: "B" as const, playerId: p.id, seeded: p.seeded ?? false })),
    ],
    sets: [{ sideAGames: options.gamesA ?? 6, sideBGames: options.gamesB ?? 0 }],
  };
}

/** Round robin among `teams` where teams[i] beats teams[j] for every i < j - a clean dominance ladder with no ties. */
function roundRobinLadder(tournamentId: string, teams: [Player, Player][]): RatingMatchRow[] {
  const rows: RatingMatchRow[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      rows.push(match(tournamentId, teams[i], teams[j], "A"));
    }
  }
  return rows;
}

describe("computeDoublesSetClubPoints", () => {
  it("scales the formula 2*(N-place+1) for N=6 pairs (12/10/8/6/4/2)", () => {
    const teams: [Player, Player][] = [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
      [{ id: "c1" }, { id: "c2" }],
      [{ id: "d1" }, { id: "d2" }],
      [{ id: "e1" }, { id: "e2" }],
      [{ id: "f1" }, { id: "f2" }],
    ];
    const points = computeDoublesSetClubPoints(roundRobinLadder("t1", teams));
    const expected = [12, 10, 8, 6, 4, 2];
    teams.forEach(([p1, p2], i) => {
      expect(points.get(p1.id)?.points).toBe(expected[i]);
      expect(points.get(p2.id)?.points).toBe(expected[i]);
    });
  });

  it("scales the formula for N=4 pairs (8/6/4/2)", () => {
    const teams: [Player, Player][] = [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
      [{ id: "c1" }, { id: "c2" }],
      [{ id: "d1" }, { id: "d2" }],
    ];
    const points = computeDoublesSetClubPoints(roundRobinLadder("t1", teams));
    const expected = [8, 6, 4, 2];
    teams.forEach(([p1, p2], i) => {
      expect(points.get(p1.id)?.points).toBe(expected[i]);
      expect(points.get(p2.id)?.points).toBe(expected[i]);
    });
  });

  it("gives the seeded partner full points and the unseeded partner half, when exactly one is seeded", () => {
    const rows = [
      match(
        "t1",
        [{ id: "winA-seeded", seeded: true }, { id: "winA-unseeded" }],
        [{ id: "loseB-1" }, { id: "loseB-2" }],
        "A",
      ),
    ];
    const points = computeDoublesSetClubPoints(rows);
    // N=2: place 1 = 4pts, place 2 = 2pts.
    expect(points.get("winA-seeded")?.points).toBe(4);
    expect(points.get("winA-unseeded")?.points).toBe(2);
    // Losing team: both unseeded - no signal, both get full points for their place.
    expect(points.get("loseB-1")?.points).toBe(2);
    expect(points.get("loseB-2")?.points).toBe(2);
  });

  it("gives both partners full points when both are seeded (no signal)", () => {
    const rows = [
      match(
        "t1",
        [{ id: "winA-1", seeded: true }, { id: "winA-2", seeded: true }],
        [{ id: "loseB-1" }, { id: "loseB-2" }],
        "A",
      ),
    ];
    const points = computeDoublesSetClubPoints(rows);
    expect(points.get("winA-1")?.points).toBe(4);
    expect(points.get("winA-2")?.points).toBe(4);
  });

  it("lets a playoff Фінал/За 3 місце result override what round-robin order would have said", () => {
    // If ranked by round-robin record alone, T1 would be best (no losses)
    // and T4 worst - but the playoff results below flip it entirely.
    const rows = [
      match("t1", [{ id: "t1-1" }, { id: "t1-2" }], [{ id: "t4-1" }, { id: "t4-2" }], "B", {
        round: "Фінал",
      }),
      match("t1", [{ id: "t2-1" }, { id: "t2-2" }], [{ id: "t3-1" }, { id: "t3-2" }], "B", {
        round: "За 3 місце",
      }),
    ];
    const points = computeDoublesSetClubPoints(rows);
    // N=4: place1=8, place2=6, place3=4, place4=2.
    expect(points.get("t4-1")?.points).toBe(8); // won the Фінал
    expect(points.get("t1-1")?.points).toBe(6); // lost the Фінал
    expect(points.get("t3-1")?.points).toBe(4); // won За 3 місце
    expect(points.get("t2-1")?.points).toBe(2); // lost За 3 місце
  });

  it("fills places the playoff didn't decide using round-robin order (gap-filling)", () => {
    const rows = [
      match("t1", [{ id: "t1-1" }, { id: "t1-2" }], [{ id: "t2-1" }, { id: "t2-2" }], "A", {
        round: "Фінал",
      }),
      // No За 3 місце match - t3/t4 are undecided by playoff, ranked by their own record instead.
      match("t1", [{ id: "t3-1" }, { id: "t3-2" }], [{ id: "t4-1" }, { id: "t4-2" }], "A"),
    ];
    const points = computeDoublesSetClubPoints(rows);
    // N=4: place1=8, place2=6, place3=4, place4=2.
    expect(points.get("t1-1")?.points).toBe(8);
    expect(points.get("t2-1")?.points).toBe(6);
    expect(points.get("t3-1")?.points).toBe(4); // won its only match - ranks ahead of t4
    expect(points.get("t4-1")?.points).toBe(2);
  });

  it("ranks purely by round-robin standings when the tournament has no playoff at all", () => {
    const teams: [Player, Player][] = [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
      [{ id: "c1" }, { id: "c2" }],
    ];
    const points = computeDoublesSetClubPoints(roundRobinLadder("t1", teams));
    // N=3: place1=6, place2=4, place3=2.
    expect(points.get("a1")?.points).toBe(6);
    expect(points.get("b1")?.points).toBe(4);
    expect(points.get("c1")?.points).toBe(2);
  });

  it("clamps points at 0 for a placement round mislabeled beyond the field size", () => {
    const rows = [
      match("t1", [{ id: "t1-1" }, { id: "t1-2" }], [{ id: "t2-1" }, { id: "t2-2" }], "A"),
      // Only 4 teams total, but this claims places 11/12 - out of range.
      match("t1", [{ id: "t3-1" }, { id: "t3-2" }], [{ id: "t4-1" }, { id: "t4-2" }], "A", {
        round: "За 11 місце",
      }),
    ];
    const points = computeDoublesSetClubPoints(rows);
    // N=4, and places 11/12 are filtered out of the "used" set, so t1/t2
    // still correctly take places 1/2 via round-robin fallback.
    expect(points.get("t1-1")?.points).toBe(8);
    expect(points.get("t2-1")?.points).toBe(6);
    expect(points.get("t3-1")?.points).toBe(0);
    expect(points.get("t4-1")?.points).toBe(0);
  });

  it("accumulates points and tournament counts across multiple tournaments", () => {
    const t1 = roundRobinLadder("t1", [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
    ]);
    const t2 = roundRobinLadder("t2", [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
    ]);
    const points = computeDoublesSetClubPoints([...t1, ...t2]);
    // N=2 each time: winner=4, loser=2 - same result both tournaments.
    expect(points.get("a1")).toEqual({ playerId: "a1", points: 8, tournamentsPlayed: 2 });
    expect(points.get("b1")).toEqual({ playerId: "b1", points: 4, tournamentsPlayed: 2 });
  });
});
