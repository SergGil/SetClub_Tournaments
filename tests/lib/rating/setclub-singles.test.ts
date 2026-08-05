import { describe, expect, it } from "vitest";

import type { RatingMatchRow } from "@/lib/rating/engine";
import { computeSinglesSetClubPoints } from "@/lib/rating/setclub-singles";

let nextId = 0;

function match(
  tournamentId: string,
  playerA: string,
  playerB: string,
  winnerSide: "A" | "B",
  options: { round?: string | null; participantCount?: number } = {},
): RatingMatchRow {
  nextId += 1;
  return {
    id: `m${nextId}`,
    tournamentId,
    tournamentStartDate: 0,
    winnerSide,
    createdAt: nextId,
    round: options.round ?? null,
    tournamentParticipantCount: options.participantCount ?? 2,
    players: [
      { side: "A", playerId: playerA, seeded: false },
      { side: "B", playerId: playerB, seeded: false },
    ],
    sets: [{ sideAGames: 6, sideBGames: 0 }],
  };
}

/** Round robin among `players` where players[i] beats players[j] for every i < j - a clean dominance ladder with no ties. */
function roundRobinLadder(tournamentId: string, players: string[], participantCount?: number): RatingMatchRow[] {
  const rows: RatingMatchRow[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      rows.push(match(tournamentId, players[i], players[j], "A", { participantCount }));
    }
  }
  return rows;
}

describe("computeSinglesSetClubPoints", () => {
  it("uses the fixed base table for places 1-7, and a flat 1 point for 8th and below", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", players, 9));
    const expected = [10, 8, 6, 5, 4, 3, 2, 1, 1];
    players.forEach((p, i) => expect(points.get(p)?.points).toBe(expected[i]));
  });

  it("adds no bonus below 10 participants", () => {
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", ["p1", "p2"], 9));
    expect(points.get("p1")?.points).toBe(10); // 1st place, no bonus
    expect(points.get("p2")?.points).toBe(8); // 2nd place, no bonus
  });

  it("adds +1 for a 10-11 participant field, to every player", () => {
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", ["p1", "p2"], 10));
    expect(points.get("p1")?.points).toBe(11); // 10 + 1
    expect(points.get("p2")?.points).toBe(9); // 8 + 1

    const points11 = computeSinglesSetClubPoints(roundRobinLadder("t2", ["p1", "p2"], 11));
    expect(points11.get("p1")?.points).toBe(11);
  });

  it("adds +2 for a 12+ participant field, to every player", () => {
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", ["p1", "p2"], 12));
    expect(points.get("p1")?.points).toBe(12); // 10 + 2
    expect(points.get("p2")?.points).toBe(10); // 8 + 2
  });

  it("lets a playoff Фінал/За 3 місце result override what round-robin order would have said", () => {
    // If ranked by round-robin record alone, p1 would be best (no losses)
    // and p4 worst - but the playoff results below flip it entirely.
    const rows = [
      match("t1", "p1", "p4", "B", { round: "Фінал", participantCount: 4 }),
      match("t1", "p2", "p3", "B", { round: "За 3 місце", participantCount: 4 }),
    ];
    const points = computeSinglesSetClubPoints(rows);
    expect(points.get("p4")?.points).toBe(10); // won the Фінал
    expect(points.get("p1")?.points).toBe(8); // lost the Фінал
    expect(points.get("p3")?.points).toBe(6); // won За 3 місце
    expect(points.get("p2")?.points).toBe(5); // lost За 3 місце
  });

  it("fills places the playoff didn't decide using round-robin order (gap-filling)", () => {
    const rows = [
      match("t1", "p1", "p2", "A", { round: "Фінал", participantCount: 4 }),
      // No За 3 місце match - p3/p4 are undecided by playoff, ranked by their own record instead.
      match("t1", "p3", "p4", "A", { participantCount: 4 }),
    ];
    const points = computeSinglesSetClubPoints(rows);
    expect(points.get("p1")?.points).toBe(10);
    expect(points.get("p2")?.points).toBe(8);
    expect(points.get("p3")?.points).toBe(6); // won its only match - ranks ahead of p4
    expect(points.get("p4")?.points).toBe(5);
  });

  it("ranks purely by round-robin standings when the tournament has no playoff at all", () => {
    const players = ["p1", "p2", "p3"];
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", players, 3));
    expect(points.get("p1")?.points).toBe(10);
    expect(points.get("p2")?.points).toBe(8);
    expect(points.get("p3")?.points).toBe(6);
  });

  it("accumulates points and tournament counts across multiple tournaments", () => {
    const t1 = roundRobinLadder("t1", ["p1", "p2"], 9);
    const t2 = roundRobinLadder("t2", ["p1", "p2"], 9);
    const points = computeSinglesSetClubPoints([...t1, ...t2]);
    expect(points.get("p1")).toEqual({ playerId: "p1", points: 20, tournamentsPlayed: 2 });
    expect(points.get("p2")).toEqual({ playerId: "p2", points: 16, tournamentsPlayed: 2 });
  });
});
