import { describe, expect, it } from "vitest";

import { MINI_GROUP_ROUND } from "@/lib/playoff-rounds";
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
  it("awards 2 × (N - place + 1) points for finishing place k out of N registered participants", () => {
    const players = ["p1", "p2", "p3", "p4", "p5"];
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", players, 5));
    const expected = [10, 8, 6, 4, 2]; // 2*(5-k+1)
    players.forEach((p, i) => expect(points.get(p)?.points).toBe(expected[i]));
  });

  it("scales up for a bigger field on its own, with no separate field-size bonus needed", () => {
    const points9 = computeSinglesSetClubPoints(roundRobinLadder("t1", ["p1", "p2"], 9));
    expect(points9.get("p1")?.points).toBe(18); // 2*(9-1+1)
    expect(points9.get("p2")?.points).toBe(16); // 2*(9-2+1)

    const points12 = computeSinglesSetClubPoints(roundRobinLadder("t2", ["p1", "p2"], 12));
    expect(points12.get("p1")?.points).toBe(24); // 2*(12-1+1)
    expect(points12.get("p2")?.points).toBe(22); // 2*(12-2+1)
  });

  it("lets a playoff Фінал/За 3 місце result override what round-robin order would have said", () => {
    // If ranked by round-robin record alone, p1 would be best (no losses)
    // and p4 worst - but the playoff results below flip it entirely.
    const rows = [
      match("t1", "p1", "p4", "B", { round: "Фінал", participantCount: 4 }),
      match("t1", "p2", "p3", "B", { round: "За 3 місце", participantCount: 4 }),
    ];
    const points = computeSinglesSetClubPoints(rows);
    expect(points.get("p4")?.points).toBe(8); // won the Фінал: 2*(4-1+1)
    expect(points.get("p1")?.points).toBe(6); // lost the Фінал
    expect(points.get("p3")?.points).toBe(4); // won За 3 місце
    expect(points.get("p2")?.points).toBe(2); // lost За 3 місце
  });

  it("fills places the playoff didn't decide using round-robin order (gap-filling)", () => {
    const rows = [
      match("t1", "p1", "p2", "A", { round: "Фінал", participantCount: 4 }),
      // No За 3 місце match - p3/p4 are undecided by playoff, ranked by their own record instead.
      match("t1", "p3", "p4", "A", { participantCount: 4 }),
    ];
    const points = computeSinglesSetClubPoints(rows);
    expect(points.get("p1")?.points).toBe(8);
    expect(points.get("p2")?.points).toBe(6);
    expect(points.get("p3")?.points).toBe(4); // won its only match - ranks ahead of p4
    expect(points.get("p4")?.points).toBe(2);
  });

  it("ranks purely by round-robin standings when the tournament has no playoff at all", () => {
    const players = ["p1", "p2", "p3"];
    const points = computeSinglesSetClubPoints(roundRobinLadder("t1", players, 3));
    expect(points.get("p1")?.points).toBe(6);
    expect(points.get("p2")?.points).toBe(4);
    expect(points.get("p3")?.points).toBe(2);
  });

  it("accumulates points and tournament counts across multiple tournaments", () => {
    const t1 = roundRobinLadder("t1", ["p1", "p2"], 9);
    const t2 = roundRobinLadder("t2", ["p1", "p2"], 9);
    const points = computeSinglesSetClubPoints([...t1, ...t2]);
    expect(points.get("p1")).toEqual({ playerId: "p1", points: 36, tournamentsPlayed: 2 }); // 18*2
    expect(points.get("p2")).toEqual({ playerId: "p2", points: 32, tournamentsPlayed: 2 }); // 16*2
  });

  describe("GROUPS_12_PLAYOFF mini-group (places 9-12)", () => {
    it("ranks the four mini-group candidates by their record in ONLY the 6 mini-group matches, not their whole-tournament record", () => {
      const rows = [
        // Places 1-8, decided by the real playoff.
        match("t1", "p1", "p2", "A", { round: "Фінал", participantCount: 12 }),
        match("t1", "p3", "p4", "A", { round: "За 3 місце", participantCount: 12 }),
        match("t1", "p5", "p6", "A", { round: "За 5 місце", participantCount: 12 }),
        match("t1", "p7", "p8", "A", { round: "За 7 місце", participantCount: 12 }),

        // Group-stage "noise": m1 lost both of these, m2 won both. If this
        // leaked into the mini-group ranking, m2 would outrank m1 despite
        // m1 sweeping the actual mini round robin below.
        match("t1", "p1", "m1", "A", { participantCount: 12 }),
        match("t1", "p3", "m1", "A", { participantCount: 12 }),
        match("t1", "m2", "p5", "A", { participantCount: 12 }),
        match("t1", "m2", "p7", "A", { participantCount: 12 }),

        // The mini round robin itself: a clean ladder, m1 > m2 > m3 > m4.
        match("t1", "m1", "m2", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
        match("t1", "m1", "m3", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
        match("t1", "m1", "m4", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
        match("t1", "m2", "m3", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
        match("t1", "m2", "m4", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
        match("t1", "m3", "m4", "A", { round: MINI_GROUP_ROUND, participantCount: 12 }),
      ];
      const points = computeSinglesSetClubPoints(rows);
      expect(points.get("m1")?.points).toBe(8); // 9th: 2*(12-9+1) - swept the mini group
      expect(points.get("m2")?.points).toBe(6); // 10th - despite winning both "outside" matches
      expect(points.get("m3")?.points).toBe(4); // 11th
      expect(points.get("m4")?.points).toBe(2); // 12th - lost the whole mini group
    });

    it("still resolves via the whole-tournament fallback when there's no mini-group at all", () => {
      // Sanity check: a tournament that never tags any MINI_GROUP_ROUND
      // match (i.e. not GROUPS_12_PLAYOFF) behaves exactly as before.
      const rows = [
        match("t1", "p1", "p2", "A", { round: "Фінал", participantCount: 4 }),
        match("t1", "p3", "p4", "A", { participantCount: 4 }),
      ];
      const points = computeSinglesSetClubPoints(rows);
      expect(points.get("p3")?.points).toBe(4);
      expect(points.get("p4")?.points).toBe(2);
    });
  });
});
