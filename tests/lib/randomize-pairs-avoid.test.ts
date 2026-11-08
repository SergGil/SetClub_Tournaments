import { describe, expect, it, vi } from "vitest";

import {
  buildCustomGroupsDoublesRoundRobin,
  buildRandomDoublesPairing,
  drawAvoidingPairs,
  pairKey,
  type Team,
} from "@/lib/randomize-pairs";

const team = (a: string, b: string): Team => ({ playerIds: [a, b] });
const teamKey = (t: Team) => pairKey(t.playerIds[0], t.playerIds[1]);

describe("pairKey", () => {
  it("is the same whichever order the two players come in", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });

  it("tells different pairs apart", () => {
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});

describe("drawAvoidingPairs", () => {
  it("draws exactly once when there's nothing to avoid", () => {
    const draw = vi.fn(() => ({ randomTeams: [team("a", "b")] }));
    drawAvoidingPairs(draw, new Set());
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("returns the first draw without a forbidden pair", () => {
    const results = [
      { randomTeams: [team("a", "b")] },
      { randomTeams: [team("b", "a")] },
      { randomTeams: [team("a", "c")] },
      { randomTeams: [team("a", "d")] },
    ];
    let i = 0;
    const draw = vi.fn(() => results[i++]);
    expect(drawAvoidingPairs(draw, new Set([pairKey("a", "b")]))).toBe(results[2]);
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it("falls back to the draw with the fewest repeats when none avoids them all", () => {
    const results = [
      { randomTeams: [team("a", "b"), team("c", "d")] },
      { randomTeams: [team("a", "b"), team("c", "e")] },
      { randomTeams: [team("a", "b"), team("c", "d")] },
    ];
    let i = 0;
    const draw = vi.fn(() => results[i++]);
    expect(drawAvoidingPairs(draw, new Set([pairKey("a", "b"), pairKey("c", "d")]), 3)).toBe(results[1]);
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it("doesn't count fixed (admin pre-set) teams as repeats", () => {
    const draw = vi.fn(() => ({ fixedTeams: [team("a", "b")], randomTeams: [team("c", "d")] }));
    drawAvoidingPairs(draw, new Set([pairKey("a", "b")]));
    expect(draw).toHaveBeenCalledTimes(1);
  });
});

describe("drawAvoidingPairs with the real doubles draw", () => {
  // 4 seeded + 4 unseeded, and all 4 pairs from last time are back.
  const participants = [
    ...["s1", "s2", "s3", "s4"].map((playerId) => ({ playerId, seeded: true })),
    ...["u1", "u2", "u3", "u4"].map((playerId) => ({ playerId, seeded: false })),
  ];
  const lastPairs = new Set([pairKey("s1", "u1"), pairKey("s2", "u2"), pairKey("s3", "u3"), pairKey("s4", "u4")]);

  it("never repeats a pair and still pairs one seeded with one unseeded", () => {
    for (let i = 0; i < 300; i++) {
      const { randomTeams } = drawAvoidingPairs(() => buildRandomDoublesPairing(participants), lastPairs);
      expect(randomTeams).toHaveLength(4);
      expect(randomTeams.filter((t) => lastPairs.has(teamKey(t)))).toEqual([]);
      for (const t of randomTeams) {
        expect(t.playerIds[0]).toMatch(/^s/);
        expect(t.playerIds[1]).toMatch(/^u/);
      }
    }
  });

  it("stays equally random among the pairings without a repeat", () => {
    // Exactly 9 of the 24 seeded+unseeded pairings avoid all 4 old pairs
    // (the derangements of 4) - each should come up about equally often.
    const counts = new Map<string, number>();
    for (let i = 0; i < 9000; i++) {
      const { randomTeams } = drawAvoidingPairs(() => buildRandomDoublesPairing(participants), lastPairs);
      const signature = randomTeams.map(teamKey).sort().join(",");
      counts.set(signature, (counts.get(signature) ?? 0) + 1);
    }
    expect(counts.size).toBe(9);
    for (const count of counts.values()) {
      // Expected 1000 each; ±200 is over 6 standard deviations, so this doesn't flake.
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });

  it("keeps a repeat the roster leaves no way around", () => {
    const { randomTeams } = drawAvoidingPairs(
      () => buildRandomDoublesPairing([{ playerId: "s1", seeded: true }, { playerId: "u1", seeded: false }]),
      new Set([pairKey("s1", "u1")]),
    );
    expect(randomTeams.map(teamKey)).toEqual([pairKey("s1", "u1")]);
  });

  it("avoids repeats within groups too", () => {
    const grouped = [
      ...["s1", "u1", "s2", "u2"].map((playerId) => ({ playerId, seeded: playerId.startsWith("s"), group: 1 })),
      ...["s3", "u3", "s4", "u4"].map((playerId) => ({ playerId, seeded: playerId.startsWith("s"), group: 2 })),
    ];
    for (let i = 0; i < 200; i++) {
      const { randomTeams } = drawAvoidingPairs(() => buildCustomGroupsDoublesRoundRobin(grouped), lastPairs);
      expect(randomTeams).toHaveLength(4);
      expect(randomTeams.filter((t) => lastPairs.has(teamKey(t)))).toEqual([]);
    }
  });
});
