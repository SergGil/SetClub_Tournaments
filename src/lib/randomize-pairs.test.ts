import { describe, expect, it } from "vitest";

import {
  buildRandomDoublesPairing,
  buildSeededSinglesRoundRobin,
  buildSinglesRoundRobin,
} from "@/lib/randomize-pairs";
import type { ParticipantInput } from "@/lib/randomize-pairs";

function makeParticipants(seededCount: number, unseededCount: number): ParticipantInput[] {
  const seeded = Array.from({ length: seededCount }, (_, i) => ({
    playerId: `seeded-${i}`,
    seeded: true,
  }));
  const unseeded = Array.from({ length: unseededCount }, (_, i) => ({
    playerId: `unseeded-${i}`,
    seeded: false,
  }));
  return [...seeded, ...unseeded];
}

function teamKey(team: { playerIds: [string, string] }) {
  return [...team.playerIds].sort().join("+");
}

describe("buildRandomDoublesPairing", () => {
  it("uses every participant exactly once across teams and unpaired", () => {
    const participants = makeParticipants(4, 4);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    const teamPlayers = new Set(matchups.flatMap((m) => [...m.sideA.playerIds, ...m.sideB.playerIds]));
    expect([...teamPlayers, ...unpaired].sort()).toEqual(participants.map((p) => p.playerId).sort());
  });

  it("pairs each team from a different basket when baskets are equal", () => {
    const participants = makeParticipants(4, 4);
    const { matchups } = buildRandomDoublesPairing(participants);
    const teams = new Map<string, [string, string]>();
    for (const m of matchups) {
      teams.set(teamKey(m.sideA), m.sideA.playerIds);
      teams.set(teamKey(m.sideB), m.sideB.playerIds);
    }
    for (const [a, b] of teams.values()) {
      expect(a.startsWith("seeded-")).not.toBe(b.startsWith("seeded-"));
    }
  });

  it("makes every team play every other team exactly once (round robin)", () => {
    const participants = makeParticipants(4, 4); // -> 4 teams
    const { matchups } = buildRandomDoublesPairing(participants);
    const teamIds = new Set(matchups.flatMap((m) => [teamKey(m.sideA), teamKey(m.sideB)]));
    const teamCount = teamIds.size;
    expect(teamCount).toBe(4);
    // C(4,2) = 6 matchups, and no matchup repeats.
    expect(matchups.length).toBe((teamCount * (teamCount - 1)) / 2);
    const seen = new Set<string>();
    for (const m of matchups) {
      const key = [teamKey(m.sideA), teamKey(m.sideB)].sort().join(" vs ");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("produces no duplicate players within a single team", () => {
    const participants = makeParticipants(5, 3);
    const { matchups } = buildRandomDoublesPairing(participants);
    const teams = new Map<string, [string, string]>();
    for (const m of matchups) {
      teams.set(teamKey(m.sideA), m.sideA.playerIds);
      teams.set(teamKey(m.sideB), m.sideB.playerIds);
    }
    for (const [a, b] of teams.values()) {
      expect(a).not.toBe(b);
    }
  });

  it("leaves one player unpaired with an odd total", () => {
    const participants = makeParticipants(3, 2);
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    expect(unpaired.length).toBe(1);
    const teamPlayers = new Set(matchups.flatMap((m) => [...m.sideA.playerIds, ...m.sideB.playerIds]));
    expect(teamPlayers.size + unpaired.length).toBe(participants.length);
  });

  it("returns no matchups when fewer than 4 participants", () => {
    const participants = makeParticipants(1, 2);
    const { matchups } = buildRandomDoublesPairing(participants);
    expect(matchups).toEqual([]);
  });

  it("handles an all-seeded basket by pairing leftovers together", () => {
    const participants = makeParticipants(8, 0); // -> 4 teams, round robin C(4,2)=6
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    expect(unpaired).toEqual([]);
    expect(matchups.length).toBe(6);
  });

  it("still round-robins an odd number of teams", () => {
    const participants = makeParticipants(3, 3); // -> 3 teams, C(3,2)=3
    const { matchups, unpaired } = buildRandomDoublesPairing(participants);
    expect(unpaired).toEqual([]);
    expect(matchups.length).toBe(3);
  });
});

describe("buildSinglesRoundRobin", () => {
  const players = ["p1", "p2", "p3", "p4", "p5"];

  it("makes every player play every other player exactly once", () => {
    const matchups = buildSinglesRoundRobin(players);
    expect(matchups.length).toBe((players.length * (players.length - 1)) / 2);
    const seen = new Set<string>();
    for (const m of matchups) {
      const key = [m.sideA, m.sideB].sort().join(" vs ");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("never pairs a player against themselves", () => {
    const matchups = buildSinglesRoundRobin(players);
    for (const m of matchups) {
      expect(m.sideA).not.toBe(m.sideB);
    }
  });

  it("includes every player the same number of times", () => {
    const matchups = buildSinglesRoundRobin(players);
    const counts = new Map<string, number>();
    for (const m of matchups) {
      counts.set(m.sideA, (counts.get(m.sideA) ?? 0) + 1);
      counts.set(m.sideB, (counts.get(m.sideB) ?? 0) + 1);
    }
    for (const player of players) {
      expect(counts.get(player)).toBe(players.length - 1);
    }
  });

  it("returns no matchups for fewer than 2 players", () => {
    expect(buildSinglesRoundRobin([])).toEqual([]);
    expect(buildSinglesRoundRobin(["p1"])).toEqual([]);
  });
});

describe("buildSeededSinglesRoundRobin", () => {
  function makeParticipants(seededCount: number, unseededCount: number): ParticipantInput[] {
    const seeded = Array.from({ length: seededCount }, (_, i) => ({
      playerId: `seeded-${i}`,
      seeded: true,
    }));
    const unseeded = Array.from({ length: unseededCount }, (_, i) => ({
      playerId: `unseeded-${i}`,
      seeded: false,
    }));
    return [...seeded, ...unseeded];
  }

  it("never matches a seeded player against an unseeded one", () => {
    const matchups = buildSeededSinglesRoundRobin(makeParticipants(4, 3));
    for (const m of matchups) {
      expect(m.sideA.startsWith("seeded-")).toBe(m.sideB.startsWith("seeded-"));
    }
  });

  it("labels each matchup with the group it came from", () => {
    const matchups = buildSeededSinglesRoundRobin(makeParticipants(3, 2));
    for (const m of matchups) {
      const expectedGroup = m.sideA.startsWith("seeded-") ? "SEEDED" : "UNSEEDED";
      expect(m.group).toBe(expectedGroup);
    }
  });

  it("round-robins each group independently (C(s,2) + C(u,2) matchups)", () => {
    const matchups = buildSeededSinglesRoundRobin(makeParticipants(4, 3));
    // C(4,2) + C(3,2) = 6 + 3 = 9
    expect(matchups.length).toBe(9);
    const seen = new Set<string>();
    for (const m of matchups) {
      const key = [m.sideA, m.sideB].sort().join(" vs ");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("produces no matchups for a group with fewer than 2 players", () => {
    const matchups = buildSeededSinglesRoundRobin(makeParticipants(1, 1));
    expect(matchups).toEqual([]);
  });

  it("falls back to a single round robin when nobody is seeded", () => {
    const matchups = buildSeededSinglesRoundRobin(makeParticipants(0, 4));
    expect(matchups.length).toBe(6); // C(4,2)
    expect(matchups.every((m) => m.group === "UNSEEDED")).toBe(true);
  });
});
