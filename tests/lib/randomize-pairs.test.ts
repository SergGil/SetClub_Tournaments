import { describe, expect, it } from "vitest";

import {
  assignUngroupedDoublesToGroups,
  assignUngroupedToGroups,
  buildCustomGroupsDoublesRoundRobin,
  buildCustomGroupsSinglesRoundRobin,
  buildRandomDoublesPairing,
  buildSeededSinglesRoundRobin,
  buildSinglesRoundRobin,
  groupRoundLabel,
} from "@/lib/randomize-pairs";
import type { GroupParticipantInput, ParticipantInput } from "@/lib/randomize-pairs";

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

  it("keeps a fixed team together and excludes it from the random draw", () => {
    const participants = makeParticipants(4, 4); // 8 players -> 4 teams total
    const fixed: [string, string] = ["seeded-0", "unseeded-0"];
    const result = buildRandomDoublesPairing(participants, [fixed]);

    expect(result.fixedTeams).toEqual([{ playerIds: fixed }]);
    expect(result.seededOrder).not.toContain("seeded-0");
    expect(result.unseededOrder).not.toContain("unseeded-0");
    expect(result.randomTeams.some((t) => t.playerIds.includes("seeded-0"))).toBe(false);
    expect(result.randomTeams.some((t) => t.playerIds.includes("unseeded-0"))).toBe(false);
    // 4 teams total (1 fixed + 3 random) -> C(4,2) = 6 matchups.
    expect(result.matchups.length).toBe(6);
  });

  it("plays the fixed team against every other team in the round robin", () => {
    const participants = makeParticipants(4, 4);
    const fixed: [string, string] = ["seeded-0", "unseeded-0"];
    const { matchups } = buildRandomDoublesPairing(participants, [fixed]);

    const opponentsOfFixed = matchups
      .filter((m) => teamKey(m.sideA) === teamKey({ playerIds: fixed }) || teamKey(m.sideB) === teamKey({ playerIds: fixed }))
      .map((m) => (teamKey(m.sideA) === teamKey({ playerIds: fixed }) ? teamKey(m.sideB) : teamKey(m.sideA)));
    // 4 teams total, so the fixed team should face the other 3.
    expect(opponentsOfFixed.length).toBe(3);
    expect(new Set(opponentsOfFixed).size).toBe(3);
  });

  it("supports multiple fixed teams at once", () => {
    const participants = makeParticipants(4, 4);
    const fixedA: [string, string] = ["seeded-0", "unseeded-0"];
    const fixedB: [string, string] = ["seeded-1", "unseeded-1"];
    const result = buildRandomDoublesPairing(participants, [fixedA, fixedB]);

    expect(result.fixedTeams).toEqual([{ playerIds: fixedA }, { playerIds: fixedB }]);
    expect(result.randomTeams.length).toBe(2); // remaining 4 players -> 2 teams
    // 4 teams total -> C(4,2) = 6 matchups.
    expect(result.matchups.length).toBe(6);
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

describe("buildCustomGroupsSinglesRoundRobin", () => {
  function makeGroupParticipants(counts: Record<number, number>): GroupParticipantInput[] {
    return Object.entries(counts).flatMap(([group, count]) =>
      Array.from({ length: count }, (_, i) => ({
        playerId: `g${group}-${i}`,
        group: Number(group),
      })),
    );
  }

  it("never matches players from different groups", () => {
    const matchups = buildCustomGroupsSinglesRoundRobin(makeGroupParticipants({ 1: 3, 2: 4 }));
    for (const m of matchups) {
      expect(m.sideA.split("-")[0]).toBe(m.sideB.split("-")[0]);
    }
  });

  it("labels each matchup with its group number", () => {
    const matchups = buildCustomGroupsSinglesRoundRobin(makeGroupParticipants({ 1: 3, 2: 2 }));
    for (const m of matchups) {
      expect(`g${m.group}`).toBe(m.sideA.split("-")[0]);
    }
  });

  it("round-robins each group independently (sum of C(n,2) per group)", () => {
    const matchups = buildCustomGroupsSinglesRoundRobin(makeGroupParticipants({ 1: 4, 2: 3, 3: 2 }));
    // C(4,2) + C(3,2) + C(2,2) = 6 + 3 + 1 = 10
    expect(matchups.length).toBe(10);
    const seen = new Set<string>();
    for (const m of matchups) {
      const key = [m.sideA, m.sideB].sort().join(" vs ");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("produces no matchups for a group with only 1 player", () => {
    const matchups = buildCustomGroupsSinglesRoundRobin(makeGroupParticipants({ 1: 1, 2: 1 }));
    expect(matchups).toEqual([]);
  });

  it("supports up to 6 groups at once", () => {
    const matchups = buildCustomGroupsSinglesRoundRobin(
      makeGroupParticipants({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 }),
    );
    // 6 groups x C(2,2)=1 each -> 6 matchups
    expect(matchups.length).toBe(6);
    expect(new Set(matchups.map((m) => m.group))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("returns no matchups for an empty roster", () => {
    expect(buildCustomGroupsSinglesRoundRobin([])).toEqual([]);
  });
});

describe("groupRoundLabel", () => {
  it("formats a group number as a Ukrainian round label", () => {
    expect(groupRoundLabel(1)).toBe("Група 1");
    expect(groupRoundLabel(6)).toBe("Група 6");
  });
});

describe("assignUngroupedToGroups", () => {
  it("returns an empty map when no group is in use yet", () => {
    const participants = [
      { playerId: "p1", group: null },
      { playerId: "p2", group: null },
    ];
    expect(assignUngroupedToGroups(participants).size).toBe(0);
  });

  it("leaves already-grouped participants out of the returned assignment", () => {
    const participants = [
      { playerId: "p1", group: 1 },
      { playerId: "p2", group: null },
    ];
    const assignment = assignUngroupedToGroups(participants);
    expect(assignment.has("p1")).toBe(false);
    expect(assignment.get("p2")).toBe(1);
  });

  it("only assigns groups that are already in use", () => {
    const participants = [
      { playerId: "p1", group: 2 },
      { playerId: "p2", group: 4 },
      ...Array.from({ length: 10 }, (_, i) => ({ playerId: `u${i}`, group: null })),
    ];
    const assignment = assignUngroupedToGroups(participants);
    for (const group of assignment.values()) {
      expect([2, 4]).toContain(group);
    }
  });

  it("balances group sizes evenly when the count divides cleanly", () => {
    const participants = [
      { playerId: "p1", group: 1 },
      { playerId: "p2", group: 2 },
      ...Array.from({ length: 8 }, (_, i) => ({ playerId: `u${i}`, group: null })),
    ];
    const assignment = assignUngroupedToGroups(participants);
    const counts = new Map<number, number>();
    for (const group of assignment.values()) counts.set(group, (counts.get(group) ?? 0) + 1);
    expect(counts.get(1)).toBe(4);
    expect(counts.get(2)).toBe(4);
  });

  it("assigns every ungrouped participant exactly once", () => {
    const participants = [
      { playerId: "p1", group: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ playerId: `u${i}`, group: null })),
    ];
    const assignment = assignUngroupedToGroups(participants);
    expect(assignment.size).toBe(5);
    for (let i = 0; i < 5; i++) expect(assignment.has(`u${i}`)).toBe(true);
  });
});

describe("assignUngroupedDoublesToGroups", () => {
  it("returns an empty map when no group is in use yet", () => {
    const participants = [
      { playerId: "p1", group: null },
      { playerId: "p2", group: null },
    ];
    expect(assignUngroupedDoublesToGroups(participants).size).toBe(0);
  });

  it("keeps a fixed pair together in the same group even when both are ungrouped", () => {
    const participants = [
      { playerId: "g1", group: 1 },
      { playerId: "g2", group: 2 },
      { playerId: "a", group: null },
      { playerId: "b", group: null },
    ];
    const assignment = assignUngroupedDoublesToGroups(participants, [["a", "b"]]);
    expect(assignment.get("a")).toBeDefined();
    expect(assignment.get("a")).toBe(assignment.get("b"));
  });

  it("makes the ungrouped half of a fixed pair inherit its partner's existing group", () => {
    const participants = [
      { playerId: "g1", group: 1 },
      { playerId: "g2", group: 2 },
      { playerId: "a", group: 1 },
      { playerId: "b", group: null },
    ];
    const assignment = assignUngroupedDoublesToGroups(participants, [["a", "b"]]);
    expect(assignment.has("a")).toBe(false); // already grouped, not part of the returned assignment
    expect(assignment.get("b")).toBe(1);
  });

  it("does not split a fixed pair across two different groups", () => {
    for (let i = 0; i < 20; i++) {
      const participants = [
        { playerId: "g1", group: 1 },
        { playerId: "g2", group: 2 },
        { playerId: "g3", group: 3 },
        { playerId: "a", group: null },
        { playerId: "b", group: null },
      ];
      const assignment = assignUngroupedDoublesToGroups(participants, [["a", "b"]]);
      expect(assignment.get("a")).toBe(assignment.get("b"));
    }
  });

  it("assigns individually-ungrouped, non-paired participants independently", () => {
    const participants = [
      { playerId: "g1", group: 1 },
      { playerId: "u1", group: null },
      { playerId: "u2", group: null },
    ];
    const assignment = assignUngroupedDoublesToGroups(participants);
    expect(assignment.get("u1")).toBe(1);
    expect(assignment.get("u2")).toBe(1);
  });
});

describe("buildCustomGroupsDoublesRoundRobin", () => {
  function makeGroupParticipants(
    counts: Record<number, { seeded: number; unseeded: number }>,
  ): { playerId: string; seeded: boolean; group: number }[] {
    return Object.entries(counts).flatMap(([group, { seeded, unseeded }]) => [
      ...Array.from({ length: seeded }, (_, i) => ({
        playerId: `g${group}-seeded-${i}`,
        seeded: true,
        group: Number(group),
      })),
      ...Array.from({ length: unseeded }, (_, i) => ({
        playerId: `g${group}-unseeded-${i}`,
        seeded: false,
        group: Number(group),
      })),
    ]);
  }

  it("never forms a team or matchup across two different groups", () => {
    const participants = makeGroupParticipants({
      1: { seeded: 2, unseeded: 2 },
      2: { seeded: 2, unseeded: 2 },
    });
    const { randomTeams, matchups } = buildCustomGroupsDoublesRoundRobin(participants);
    for (const team of randomTeams) {
      const groups = team.playerIds.map((id) => id.split("-")[0]);
      expect(groups[0]).toBe(groups[1]);
    }
    for (const m of matchups) {
      const groupOf = (team: { playerIds: [string, string] }) => team.playerIds[0].split("-")[0];
      expect(groupOf(m.sideA)).toBe(groupOf(m.sideB));
      expect(`g${m.group}`).toBe(groupOf(m.sideA));
    }
  });

  it("round-robins each group's teams independently (sum of C(teams,2) per group)", () => {
    // Group 1: 4 players -> 2 teams -> C(2,2)=1. Group 2: 8 players -> 4 teams -> C(4,2)=6.
    const participants = makeGroupParticipants({
      1: { seeded: 2, unseeded: 2 },
      2: { seeded: 4, unseeded: 4 },
    });
    const { matchups } = buildCustomGroupsDoublesRoundRobin(participants);
    expect(matchups.length).toBe(7);
  });

  it("keeps a fixed team together within its group and out of the random draw", () => {
    const participants = makeGroupParticipants({ 1: { seeded: 2, unseeded: 2 } });
    const fixed: [string, string] = ["g1-seeded-0", "g1-unseeded-0"];
    const { fixedTeams, randomTeams } = buildCustomGroupsDoublesRoundRobin(participants, [fixed]);
    expect(fixedTeams).toEqual([{ playerIds: fixed, group: 1 }]);
    expect(randomTeams.some((t) => t.playerIds.includes("g1-seeded-0"))).toBe(false);
  });

  it("returns no matchups for an empty roster", () => {
    const { matchups, fixedTeams, randomTeams, unpaired } = buildCustomGroupsDoublesRoundRobin([]);
    expect(matchups).toEqual([]);
    expect(fixedTeams).toEqual([]);
    expect(randomTeams).toEqual([]);
    expect(unpaired).toEqual([]);
  });
});
