import { describe, expect, it } from "vitest";

import type { SnapshotAdvancement, SnapshotMatch, TournamentBracketSnapshot } from "@/lib/bracket-advancement";
import { computeAdvancementPropagation } from "@/lib/bracket-advancement";

function match(overrides: Partial<SnapshotMatch> & { id: string }): SnapshotMatch {
  return {
    round: null,
    status: "SCHEDULED",
    winnerSide: null,
    players: [],
    sets: [],
    walkover: false,
    ...overrides,
  };
}

function snapshot(
  matches: SnapshotMatch[],
  advancements: SnapshotAdvancement[],
  participants: ({ playerId: string; group: number | null } & { withdrawnAt?: string | null })[],
  format: "SINGLES" | "DOUBLES" = "SINGLES",
): TournamentBracketSnapshot {
  return {
    matches,
    advancements,
    format,
    participants: participants.map((p) => ({ withdrawnAt: null, ...p, name: p.playerId })),
  };
}

describe("computeAdvancementPropagation", () => {
  it("does nothing for a snapshot with zero MatchAdvancement rows", () => {
    const snap = snapshot(
      [match({ id: "m1", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "x" }, { side: "B", playerId: "y" }] })],
      [],
      [{ playerId: "x", group: null }, { playerId: "y", group: null }],
    );
    expect(computeAdvancementPropagation(snap, "m1")).toEqual({ fills: [], resets: [] });
  });

  it("forward-fills a MATCH_RESULT slot once its source match completes", () => {
    const snap = snapshot(
      [
        match({ id: "m1", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "x" }, { side: "B", playerId: "y" }] }),
        match({ id: "m2" }),
      ],
      [{ matchId: "m2", side: "A", source: "MATCH_RESULT", sourceMatchId: "m1", outcome: "WINNER" }],
      [{ playerId: "x", group: null }, { playerId: "y", group: null }],
    );
    const result = computeAdvancementPropagation(snap, "m1");
    expect(result.fills).toEqual([{ matchId: "m2", side: "A", playerIds: ["x"] }]);
    expect(result.resets).toEqual([]);
  });

  it("forward-fills GROUP_RANK slots once every one of the group's matches is completed", () => {
    const snap = snapshot(
      [
        match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
        match({ id: "m_ac", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
        match({ id: "m_bc", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "b" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
        match({ id: "d1" }),
      ],
      [
        { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
        { matchId: "d1", side: "B", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 2 },
      ],
      [{ playerId: "a", group: 1 }, { playerId: "b", group: 1 }, { playerId: "c", group: 1 }],
    );
    // a won both its matches -> 1st; b and c split 1-1 against each other -> b beat c, so b is 2nd.
    const result = computeAdvancementPropagation(snap, "m_bc");
    expect(result.fills).toEqual(
      expect.arrayContaining([
        { matchId: "d1", side: "A", playerIds: ["a"] },
        { matchId: "d1", side: "B", playerIds: ["b"] },
      ]),
    );
    expect(result.resets).toEqual([]);
  });

  it("does not fill a GROUP_RANK slot until the whole group's round robin is complete", () => {
    const snap = snapshot(
      [
        match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
        match({ id: "m_ac" }), // not played yet
        match({ id: "m_bc" }),
        match({ id: "d1" }),
      ],
      [{ matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 }],
      [{ playerId: "a", group: 1 }, { playerId: "b", group: 1 }, { playerId: "c", group: 1 }],
    );
    expect(computeAdvancementPropagation(snap, "m_ab")).toEqual({ fills: [], resets: [] });
  });

  it("cascades a corrected match result 2+ levels down, resetting already-played downstream matches", () => {
    // m1's winner is corrected from x to y (the snapshot already reflects
    // the new winnerSide, per computeAdvancementPropagation's contract).
    // d1 was already played on the OLD result (x advanced and beat z) and
    // itself already fed d2 (x advanced again) - both must unwind.
    const snap = snapshot(
      [
        match({ id: "m1", status: "COMPLETED", winnerSide: "B", players: [{ side: "A", playerId: "x" }, { side: "B", playerId: "y" }] }),
        match({ id: "d1", round: "1/2", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "x" }, { side: "B", playerId: "z" }] }),
        match({ id: "d2", round: "Фінал", status: "SCHEDULED", players: [{ side: "A", playerId: "x" }] }),
      ],
      [
        { matchId: "d1", side: "A", source: "MATCH_RESULT", sourceMatchId: "m1", outcome: "WINNER" },
        { matchId: "d2", side: "A", source: "MATCH_RESULT", sourceMatchId: "d1", outcome: "WINNER" },
      ],
      [
        { playerId: "x", group: null },
        { playerId: "y", group: null },
        { playerId: "z", group: null },
      ],
    );
    const result = computeAdvancementPropagation(snap, "m1");
    expect(result.fills).toEqual(
      expect.arrayContaining([
        { matchId: "d1", side: "A", playerIds: ["y"] },
        { matchId: "d2", side: "A", playerIds: [] },
      ]),
    );
    expect(result.fills).toHaveLength(2);
    expect(result.resets).toEqual([{ matchId: "d1", round: "1/2" }]);
  });

  it("cascades when a same-winner score correction flips a 3-way group tiebreak", () => {
    // a/b/c are cyclic on wins (a beat b, b beat c, c beat a) - games
    // differential decides the order. m_ac's score is "corrected" (c still
    // wins, just by less) in a way that flips who has the better diff.
    const matches = [
      match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 3 }] }),
      match({ id: "m_bc", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "b" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 3 }] }),
      match({ id: "m_ac", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "c" }, { side: "B", playerId: "a" }], sets: [{ sideAGames: 6, sideBGames: 5 }] }),
      match({ id: "m_y", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "r" }, { side: "B", playerId: "s" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
      match({ id: "d1", round: "1/4", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "c" }, { side: "B", playerId: "r" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
    ];
    const advancements: SnapshotAdvancement[] = [
      { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
      { matchId: "d1", side: "B", source: "MATCH_RESULT", sourceMatchId: "m_y", outcome: "WINNER" },
    ];
    const participants = [
      { playerId: "a", group: 1 },
      { playerId: "b", group: 1 },
      { playerId: "c", group: 1 },
      { playerId: "r", group: null },
      { playerId: "s", group: null },
    ];
    const result = computeAdvancementPropagation(snapshot(matches, advancements, participants), "m_ac");
    // Before the correction, c had the best games diff (+2) - now a does (+2 vs c's -2).
    expect(result.fills).toEqual([{ matchId: "d1", side: "A", playerIds: ["a"] }]);
    expect(result.resets).toEqual([{ matchId: "d1", round: "1/4" }]);
  });

  it("produces no fills or resets for a score correction that changes neither the winner nor the tiebreak order", () => {
    const matches = [
      match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 3 }] }),
      match({ id: "m_bc", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "b" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 3 }] }),
      // Score nudged (6-2 instead of 6-1) but c still wins and still keeps the best diff overall.
      match({ id: "m_ac", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "c" }, { side: "B", playerId: "a" }], sets: [{ sideAGames: 6, sideBGames: 2 }] }),
      match({ id: "d1", players: [{ side: "A", playerId: "c" }, { side: "B", playerId: "b" }] }),
    ];
    const advancements: SnapshotAdvancement[] = [
      { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
      { matchId: "d1", side: "B", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 2 },
    ];
    const participants = [{ playerId: "a", group: 1 }, { playerId: "b", group: 1 }, { playerId: "c", group: 1 }];
    const result = computeAdvancementPropagation(snapshot(matches, advancements, participants), "m_ac");
    expect(result).toEqual({ fills: [], resets: [] });
  });

  it("un-fills and resets downstream matches when a completed group match is reopened", () => {
    const snap = snapshot(
      [
        // Reopened: the snapshot already reflects the cleared score.
        match({ id: "m_ab", status: "SCHEDULED", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }] }),
        match({ id: "m_y", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "r" }, { side: "B", playerId: "s" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
        match({ id: "d1", round: "1/2", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "r" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
      ],
      [
        { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
        { matchId: "d1", side: "B", source: "MATCH_RESULT", sourceMatchId: "m_y", outcome: "WINNER" },
      ],
      [
        { playerId: "a", group: 1 },
        { playerId: "b", group: 1 },
        { playerId: "r", group: null },
        { playerId: "s", group: null },
      ],
    );
    const result = computeAdvancementPropagation(snap, "m_ab");
    expect(result.fills).toEqual([{ matchId: "d1", side: "A", playerIds: [] }]);
    expect(result.resets).toEqual([{ matchId: "d1", round: "1/2" }]);
  });

  describe("withdrawal / walkover", () => {
    it("skips a withdrawn player for GROUP_RANK even with the best record in the group", () => {
      const snap = snapshot(
        [
          match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
          match({ id: "m_ac", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
          match({ id: "m_bc", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "b" }, { side: "B", playerId: "c" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
          match({ id: "d1" }),
        ],
        [{ matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 }],
        [
          // a won both its matches (best record) but withdrew - b (won only
          // against c) must be picked for rank 1 instead.
          { playerId: "a", group: 1, withdrawnAt: "2026-01-01T00:00:00.000Z" },
          { playerId: "b", group: 1 },
          { playerId: "c", group: 1 },
        ],
      );
      const result = computeAdvancementPropagation(snap, "m_bc");
      expect(result.fills).toEqual([{ matchId: "d1", side: "A", playerIds: ["b"] }]);
    });

    it("counts a walkover win toward the opponent's GROUP_RANK standing like any other completed match", () => {
      const snap = snapshot(
        [
          match({ id: "m_ab", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "b" }], sets: [{ sideAGames: 6, sideBGames: 0 }] }),
          // c withdrew before this match was played - a gets the walkover win.
          match({ id: "m_ac", status: "COMPLETED", winnerSide: "A", walkover: true, players: [{ side: "A", playerId: "a" }, { side: "B", playerId: "c" }], sets: [] }),
          match({ id: "m_bc", status: "COMPLETED", winnerSide: "A", walkover: true, players: [{ side: "A", playerId: "b" }, { side: "B", playerId: "c" }], sets: [] }),
          match({ id: "d1" }),
        ],
        [
          { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
          { matchId: "d1", side: "B", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 2 },
        ],
        [
          { playerId: "a", group: 1 },
          { playerId: "b", group: 1 },
          { playerId: "c", group: 1, withdrawnAt: "2026-01-01T00:00:00.000Z" },
        ],
      );
      // a: 2 wins (1 real + 1 walkover), b: 1 win (walkover) + 1 loss - a is
      // 1st, b is 2nd; c (withdrawn, 0 wins) is never a rank candidate.
      const result = computeAdvancementPropagation(snap, "m_bc");
      expect(result.fills).toEqual(
        expect.arrayContaining([
          { matchId: "d1", side: "A", playerIds: ["a"] },
          { matchId: "d1", side: "B", playerIds: ["b"] },
        ]),
      );
      expect(result.fills).toHaveLength(2);
    });
  });

  describe("DOUBLES", () => {
    function doublesMatch(
      id: string,
      sideA: [string, string],
      sideB: [string, string],
      overrides: Partial<SnapshotMatch> = {},
    ): SnapshotMatch {
      return match({
        id,
        players: [
          { side: "A", playerId: sideA[0] },
          { side: "A", playerId: sideA[1] },
          { side: "B", playerId: sideB[0] },
          { side: "B", playerId: sideB[1] },
        ],
        ...overrides,
      });
    }

    it("fills a GROUP_RANK slot with both players of the top-ranked team once the group's round robin completes", () => {
      // Group 1: team (a,b) beats team (c,d) - the only match in a 2-team group.
      const snap = snapshot(
        [
          doublesMatch("m1", ["a", "b"], ["c", "d"], {
            status: "COMPLETED",
            winnerSide: "A",
            sets: [{ sideAGames: 6, sideBGames: 0 }],
          }),
          match({ id: "d1" }),
        ],
        [
          { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
          { matchId: "d1", side: "B", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 2 },
        ],
        [
          { playerId: "a", group: 1 },
          { playerId: "b", group: 1 },
          { playerId: "c", group: 1 },
          { playerId: "d", group: 1 },
        ],
        "DOUBLES",
      );
      const result = computeAdvancementPropagation(snap, "m1");
      expect(result.fills).toEqual(
        expect.arrayContaining([
          { matchId: "d1", side: "A", playerIds: expect.arrayContaining(["a", "b"]) },
          { matchId: "d1", side: "B", playerIds: expect.arrayContaining(["c", "d"]) },
        ]),
      );
      expect(result.fills).toHaveLength(2);
    });

    it("does not fill a DOUBLES GROUP_RANK slot until the group's round robin is complete", () => {
      const snap = snapshot(
        [
          doublesMatch("m1", ["a", "b"], ["c", "d"]), // not played yet
          match({ id: "d1" }),
        ],
        [{ matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 }],
        [
          { playerId: "a", group: 1 },
          { playerId: "b", group: 1 },
          { playerId: "c", group: 1 },
          { playerId: "d", group: 1 },
        ],
        "DOUBLES",
      );
      expect(computeAdvancementPropagation(snap, "m1")).toEqual({ fills: [], resets: [] });
    });

    it("forward-fills a MATCH_RESULT slot with the whole winning team", () => {
      const snap = snapshot(
        [
          doublesMatch("m1", ["a", "b"], ["c", "d"], {
            status: "COMPLETED",
            winnerSide: "A",
            sets: [{ sideAGames: 6, sideBGames: 0 }],
          }),
          match({ id: "m2" }),
        ],
        [{ matchId: "m2", side: "A", source: "MATCH_RESULT", sourceMatchId: "m1", outcome: "WINNER" }],
        [
          { playerId: "a", group: null },
          { playerId: "b", group: null },
          { playerId: "c", group: null },
          { playerId: "d", group: null },
        ],
        "DOUBLES",
      );
      const result = computeAdvancementPropagation(snap, "m1");
      expect(result.fills).toEqual([
        { matchId: "m2", side: "A", playerIds: expect.arrayContaining(["a", "b"]) },
      ]);
    });

    it("cascade-resets a downstream DOUBLES match and clears both its players when the source team changes", () => {
      // d1 was already played with team (a,b) advanced from group 1 - a
      // correction flips who's ranked 1st, so d1 must unwind.
      const snap = snapshot(
        [
          doublesMatch("m1", ["a", "b"], ["c", "d"], {
            status: "COMPLETED",
            winnerSide: "B", // corrected: (c,d) now win instead of (a,b)
            sets: [{ sideAGames: 3, sideBGames: 6 }],
          }),
          doublesMatch("d1", ["a", "b"], ["e", "f"], {
            round: "1/2",
            status: "COMPLETED",
            winnerSide: "A",
            sets: [{ sideAGames: 6, sideBGames: 0 }],
          }),
        ],
        [
          { matchId: "d1", side: "A", source: "GROUP_RANK", sourceGroup: 1, sourceRank: 1 },
          { matchId: "d1", side: "B", source: "GROUP_RANK", sourceGroup: 2, sourceRank: 1 },
        ],
        [
          { playerId: "a", group: 1 },
          { playerId: "b", group: 1 },
          { playerId: "c", group: 1 },
          { playerId: "d", group: 1 },
          { playerId: "e", group: 2 },
          { playerId: "f", group: 2 },
        ],
        "DOUBLES",
      );
      const result = computeAdvancementPropagation(snap, "m1");
      expect(result.fills).toEqual([
        { matchId: "d1", side: "A", playerIds: expect.arrayContaining(["c", "d"]) },
      ]);
      expect(result.resets).toEqual([{ matchId: "d1", round: "1/2" }]);
    });
  });
});
