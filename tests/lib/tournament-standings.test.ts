import { beforeEach, describe, expect, it, vi } from "vitest";

import { MINI_GROUP_ROUND } from "@/lib/playoff-rounds";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { match: { findMany: vi.fn() }, tournamentGroup: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { getTournamentStandingsMock } = vi.hoisted(() => ({ getTournamentStandingsMock: vi.fn() }));
vi.mock("@/lib/stats", () => ({ getTournamentStandings: getTournamentStandingsMock }));

import { getTournamentStandingsRows } from "@/lib/tournament-standings";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.match.findMany.mockResolvedValue([]);
  // No custom (admin-named) groups by default - individual tests override
  // this when they specifically exercise that path.
  prismaMock.tournamentGroup.findMany.mockResolvedValue([]);
  getTournamentStandingsMock.mockResolvedValue(new Map());
});

describe("getTournamentStandingsRows (DOUBLES)", () => {
  it("groups by the exact pair that played together, counts games/wins only from completed matches, and lets 0-0 teams show up from a scheduled match alone", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "A",
        // Deliberately unsorted input - the team key must come out sorted by playerId regardless.
        players: [
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
        ],
        sets: [
          { sideAGames: 6, sideBGames: 4 },
          { sideAGames: 6, sideBGames: 2 },
        ],
      },
      {
        status: "SCHEDULED",
        winnerSide: null,
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a5", player: { name: "Максим" } },
          { side: "B", playerId: "a6", player: { name: "Богдан" } },
        ],
        sets: [],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const byKey = new Map(result.rows.map((r) => [r.key, r]));

    expect(byKey.get("a1+a2")).toEqual(
      expect.objectContaining({
        label: "Іван / Петро",
        matchesPlayed: 1,
        wins: 1,
        losses: 0,
        gamesWon: 12,
        gamesLost: 6,
        // Straight-sets 2-set win: 1 point per set won, none for the loser.
        points: 2,
      }),
    );
    expect(byKey.get("a3+a4")).toEqual(
      expect.objectContaining({ wins: 0, losses: 1, gamesWon: 6, gamesLost: 12, points: 0 }),
    );
    // Shows up with a clean 0-0 record purely from being in a scheduled match.
    expect(byKey.get("a5+a6")).toEqual(
      expect.objectContaining({ matchesPlayed: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0 }),
    );

    // a1+a2 has a recorded result against a3+a4 but never played a5+a6 -> not a complete round robin.
    expect(result.roundRobinDone).toBe(false);
    expect(result.rows.map((r) => r.key)).toEqual(["a1+a2", "a5+a6", "a3+a4"]);
  });

  it("awards a flat 2 points to the winner and 0 to the loser for a single-set match", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "B",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 4, sideBGames: 6 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const byKey = new Map(result.rows.map((r) => [r.key, r]));
    expect(byKey.get("a3+a4")).toEqual(expect.objectContaining({ points: 2 }));
    expect(byKey.get("a1+a2")).toEqual(expect.objectContaining({ points: 0 }));
  });

  it("awards the explicit winner points for a retired doubles match with a tied recorded set", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "A",
        retired: true,
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 0, sideBGames: 0 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const byKey = new Map(result.rows.map((r) => [r.key, r]));
    expect(byKey.get("a1+a2")).toEqual(expect.objectContaining({ wins: 1, points: 2 }));
  });

  it("splits into brackets by team when 2+ admin-assigned team-groups are in use", async () => {
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "a5", seed: null as number | null, group: 2, player: { id: "a5", name: "Максим" } },
      { playerId: "a6", seed: null as number | null, group: 2, player: { id: "a6", name: "Богдан" } },
      { playerId: "a7", seed: null as number | null, group: 2, player: { id: "a7", name: "Назар" } },
      { playerId: "a8", seed: null as number | null, group: 2, player: { id: "a8", name: "Тарас" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        status: "COMPLETED",
        winnerSide: "B",
        players: [
          { side: "A", playerId: "a5", player: { name: "Максим" } },
          { side: "A", playerId: "a6", player: { name: "Богдан" } },
          { side: "B", playerId: "a7", player: { name: "Назар" } },
          { side: "B", playerId: "a8", player: { name: "Тарас" } },
        ],
        sets: [{ sideAGames: 2, sideBGames: 6 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Група B"]);
    expect(result.groupings[0].groups[0].rows.map((r) => r.key).sort()).toEqual(["a1+a2", "a3+a4"]);
    expect(result.groupings[0].groups[1].rows.map((r) => r.key).sort()).toEqual(["a5+a6", "a7+a8"]);
    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
  });

  it("does not treat a single team-group as a real split", async () => {
    const oneGroupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", oneGroupParticipants);

    expect(result.mode).toBe("individual");
  });

  it("excludes a mismatched-group team from every bucket, and doesn't credit either group with a cross-group match", async () => {
    // Every recorded match here crosses group1/group2 - none is "internal"
    // to either group, so nobody gets real team stats from them (mirrors
    // the fix for custom groups: a match only counts toward a group's table
    // when everyone playing is a member of that same group).
    const mixedGroupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 2, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "a5", seed: null as number | null, group: 2, player: { id: "a5", name: "Максим" } },
      { playerId: "a6", seed: null as number | null, group: 2, player: { id: "a6", name: "Богдан" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "SCHEDULED",
        winnerSide: null,
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [],
      },
      {
        status: "SCHEDULED",
        winnerSide: null,
        players: [
          { side: "A", playerId: "a5", player: { name: "Максим" } },
          { side: "A", playerId: "a6", player: { name: "Богдан" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", mixedGroupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const allGroupedKeys = result.groupings[0].groups.flatMap((g) => g.rows.map((r) => r.key));
    // No team row anywhere - not even a3+a4 or a5+a6, since their only
    // recorded matches were against an opponent outside their own group.
    expect(allGroupedKeys).not.toContain("a1+a2");
    expect(allGroupedKeys).not.toContain("a3+a4");
    expect(allGroupedKeys).not.toContain("a5+a6");
    const groupA = result.groupings[0].groups.find((g) => g.label === "Група A");
    expect(groupA?.rows.map((r) => r.key).sort()).toEqual(["a1", "a3", "a4"]);
    expect(groupA?.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
    const groupB = result.groupings[0].groups.find((g) => g.label === "Група B");
    expect(groupB?.rows.map((r) => r.key).sort()).toEqual(["a2", "a5", "a6"]);
  });

  it("shows a group by itself (no team has played yet) as a placeholder player list, plus a Без групи bucket for the rest", async () => {
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 5, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 5, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: null, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: null, player: { id: "a4", name: "Данило" } },
    ];
    // The only match played so far is between two ungrouped players -
    // nobody in group 5 has played together yet.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        status: "SCHEDULED",
        winnerSide: null,
        players: [
          { side: "A", playerId: "a3", player: { name: "Олег" } },
          { side: "A", playerId: "a4", player: { name: "Данило" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groups = result.groupings[0].groups;
    const groupFive = groups.find((g) => g.label === "Група E");
    expect(groupFive?.rows.map((r) => r.key).sort()).toEqual(["a1", "a2"]);
    expect(groupFive?.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
    const withoutGroup = groups.find((g) => g.label === "Без групи");
    expect(withoutGroup?.rows.map((r) => r.key)).toContain("a3+a4");
  });

  it("shows a custom group as its own section, scoped to its own matches - group-stage and Плейофф results never leak into each other", async () => {
    // a1/a2/a3/a4 are all in built-in Група A; a1/a2 are *also* in the
    // custom "Плейофф" group at once (with a5/a6, who are Плейофф-only,
    // never in any built-in group) - the whole point of moving custom
    // groups off TournamentParticipant.group.
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "a5", seed: null as number | null, group: null, player: { id: "a5", name: "Максим" } },
      { playerId: "a6", seed: null as number | null, group: null, player: { id: "a6", name: "Богдан" } },
    ];
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      {
        number: 7,
        name: "Плейофф",
        members: [{ playerId: "a1" }, { playerId: "a2" }, { playerId: "a5" }, { playerId: "a6" }],
      },
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      // Group-stage match: both teams are Група A - must NOT count toward Плейофф.
      {
        round: "Група A",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      // Плейофф bracket match: all 4 players are Плейофф members, but a5/a6
      // aren't in Група A - must NOT count toward Група A's table.
      {
        round: "Плейофф",
        status: "COMPLETED",
        winnerSide: "B",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a5", player: { name: "Максим" } },
          { side: "B", playerId: "a6", player: { name: "Богдан" } },
        ],
        sets: [{ sideAGames: 3, sideBGames: 6 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual(["За групами", "Додаткові групи"]);
    const builtIn = result.groupings[0].groups.find((g) => g.label === "Група A");
    expect(builtIn?.rows.map((r) => r.key).sort()).toEqual(["a1+a2", "a3+a4"]);
    // a1+a2's Група A record reflects only the group-stage match (a win) -
    // the Плейофф loss against a5+a6 does not leak in.
    const builtInTeam = builtIn?.rows.find((r) => r.key === "a1+a2");
    expect(builtInTeam).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, losses: 0 }));

    const playoff = result.groupings[1].groups.find((g) => g.label === "Плейофф");
    expect(playoff?.rows.map((r) => r.key).sort()).toEqual(["a1+a2", "a5+a6"]);
    // a1+a2's Плейофф record reflects only the Плейофф match (a loss) - the
    // group-stage win against a3+a4 does not leak in.
    const playoffTeam = playoff?.rows.find((r) => r.key === "a1+a2");
    expect(playoffTeam).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 0, losses: 1 }));
    const winners = playoff?.rows.find((r) => r.key === "a5+a6");
    expect(winners).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, losses: 0 }));
  });

  it("shows a custom group's members as a placeholder list before they've played together as a pair", async () => {
    const participants = [
      { playerId: "a1", seed: null as number | null, group: null, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: null, player: { id: "a2", name: "Петро" } },
    ];
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "a1" }, { playerId: "a2" }] },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", participants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    const playoff = result.groupings[0].groups[0];
    expect(playoff.label).toBe("Плейофф");
    expect(playoff.rows.map((r) => r.key).sort()).toEqual(["a1", "a2"]);
    expect(playoff.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
  });

  it("does not leak a built-in group team match into a custom group even when BOTH teams are also custom-group members", async () => {
    // a1+a2 already beat a3+a4 inside Група A (round: "Група A"). Both teams
    // are later also added to the custom "За 7 місце" group together - a
    // player-membership-only filter would (incorrectly) count this toward
    // "За 7 місце" even though nobody has played a "За 7 місце" match yet.
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
    ];
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      {
        number: 7,
        name: "За 7 місце",
        members: [{ playerId: "a1" }, { playerId: "a2" }, { playerId: "a3" }, { playerId: "a4" }],
      },
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    // A single built-in group covering the whole roster isn't a meaningful
    // split on its own (see getTournamentStandingsRows), so "За групами"
    // doesn't get its own section here - only "За 7 місце" does.
    const customGroup = result.groupings.flatMap((g) => g.groups).find((g) => g.label === "За 7 місце");
    // Nobody has a "За 7 місце" match yet (the Група A result must not leak
    // in), so no pairing is known within this group's own scope - every
    // member shows up as an individual placeholder row instead of a team.
    expect(customGroup?.rows.map((r) => r.key).sort()).toEqual(["a1", "a2", "a3", "a4"]);
    expect(customGroup?.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
  });

  it("does not let a curated playoff rematch between two group-mate teams inflate their built-in group's own stats", async () => {
    // a1+a2 and a3+a4 are both Група A - they play once in the group stage,
    // then meet again in a real "За 3 місце" playoff match. A5/a6 (Група B)
    // exist purely so "За групами" is a meaningful 2-group split (a lone
    // group covering everyone doesn't get its own section). A built-in
    // group has no single roundFilter to anchor to, but the rematch's round
    // is still a recognized *different* (curated) context and must be
    // excluded, same as the singles case.
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "a5", seed: null as number | null, group: 2, player: { id: "a5", name: "Максим" } },
      { playerId: "a6", seed: null as number | null, group: 2, player: { id: "a6", name: "Богдан" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "За 3 місце",
        status: "COMPLETED",
        winnerSide: "B",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 4, sideBGames: 6 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupA = result.groupings.flatMap((g) => g.groups).find((g) => g.label === "Група A");
    const teamA = groupA?.rows.find((r) => r.key === "a1+a2");
    expect(teamA).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, losses: 0 }));
  });

  it("still shows a custom group with zero current members, as an empty section", async () => {
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Порожня", members: [] },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const emptyGroup = result.groupings[0].groups.find((g) => g.label === "Порожня");
    expect(emptyGroup?.rows).toEqual([]);
  });

  it("attaches a placedTable once a real decisive playoff match exists between two teams", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Фінал",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("a1+a2")).toBe(1);
    expect(byKey.get("a3+a4")).toBe(2);
    expect(result.placedTable!.complete).toBe(true);
  });

  it("does not build a placedTable when there are no decisive playoff matches at all", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: null,
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.placedTable).toBeUndefined();
  });

  it("excludes playoff matches from the plain team table above Підсумкова таблиця, even though placedTable still counts them", async () => {
    // a1+a2 beat a3+a4 once in the group stage, then again in Фінал - the
    // plain "team standings" table (shown above Підсумкова таблиця) must
    // count only the group-stage meeting; placedTable counts both.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: null,
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 4 }],
      },
      {
        round: "Фінал",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const team = result.rows.find((r) => r.key === "a1+a2");
    expect(team).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1 }));

    expect(result.placedTable).toBeDefined();
    const placedTeam = result.placedTable!.rows.find((r) => r.key === "a1+a2");
    expect(placedTeam).toEqual(expect.objectContaining({ matchesPlayed: 2, wins: 2, place: 1 }));
  });

  it("attaches a placedTable alongside a grouped ('За групами') breakdown too", async () => {
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 2, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 2, player: { id: "a4", name: "Данило" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Фінал",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.mode).toBe("grouped");
    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("a1+a2")).toBe(1);
    expect(byKey.get("a3+a4")).toBe(2);
  });

  it("ranks each group's own non-advancing team by its own already-complete round robin, even though the two groups' losers never played each other", async () => {
    // Група 1: a1+a2 beats a3+a4. Група 2: b1+b2 beats b3+b4. Only the group
    // winners meet in Фінал (a1+a2 wins) - a3+a4 and b3+b4 never play each
    // other at all, so a single combined "everyone still unplaced" round
    // robin between them could never be complete; each must be ranked off
    // its OWN group's round robin instead.
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "b1", seed: null as number | null, group: 2, player: { id: "b1", name: "Максим" } },
      { playerId: "b2", seed: null as number | null, group: 2, player: { id: "b2", name: "Богдан" } },
      { playerId: "b3", seed: null as number | null, group: 2, player: { id: "b3", name: "Кирило" } },
      { playerId: "b4", seed: null as number | null, group: 2, player: { id: "b4", name: "Роман" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "Група B",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "b1", player: { name: "Максим" } },
          { side: "A", playerId: "b2", player: { name: "Богдан" } },
          { side: "B", playerId: "b3", player: { name: "Кирило" } },
          { side: "B", playerId: "b4", player: { name: "Роман" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 3 }],
      },
      {
        round: "Фінал",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "b1", player: { name: "Максим" } },
          { side: "B", playerId: "b2", player: { name: "Богдан" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 4 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("a1+a2")).toBe(1);
    expect(byKey.get("b1+b2")).toBe(2);
    // Групи обробляються в порядку номера - "Група 1"'s own leftover fills
    // the next place before "Група 2"'s.
    expect(byKey.get("a3+a4")).toBe(3);
    expect(byKey.get("b3+b4")).toBe(4);
    expect(result.placedTable!.complete).toBe(true);
  });

  it("leaves a group's non-advancing team unplaced when that group's own round robin isn't actually complete", async () => {
    const groupParticipants = [
      { playerId: "a1", seed: null as number | null, group: 1, player: { id: "a1", name: "Іван" } },
      { playerId: "a2", seed: null as number | null, group: 1, player: { id: "a2", name: "Петро" } },
      { playerId: "a3", seed: null as number | null, group: 1, player: { id: "a3", name: "Олег" } },
      { playerId: "a4", seed: null as number | null, group: 1, player: { id: "a4", name: "Данило" } },
      { playerId: "a5", seed: null as number | null, group: 1, player: { id: "a5", name: "Максим" } },
      { playerId: "a6", seed: null as number | null, group: 1, player: { id: "a6", name: "Богдан" } },
    ];
    prismaMock.match.findMany.mockResolvedValueOnce([
      // a1+a2 beat a3+a4, decided via Фінал - but a3+a4 never played a5+a6,
      // so Група 1's own round robin (3 teams) isn't complete.
      {
        round: null,
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a3", player: { name: "Олег" } },
          { side: "B", playerId: "a4", player: { name: "Данило" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "Фінал",
        status: "COMPLETED",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "a1", player: { name: "Іван" } },
          { side: "A", playerId: "a2", player: { name: "Петро" } },
          { side: "B", playerId: "a5", player: { name: "Максим" } },
          { side: "B", playerId: "a6", player: { name: "Богдан" } },
        ],
        sets: [{ sideAGames: 6, sideBGames: 4 }],
      },
    ]);

    const result = await getTournamentStandingsRows("t1", "DOUBLES", groupParticipants);

    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("a1+a2")).toBe(1);
    expect(byKey.get("a5+a6")).toBe(2);
    expect(byKey.get("a3+a4")).toBeNull();
    expect(result.placedTable!.complete).toBe(false);
  });
});

const participants = [
  { playerId: "p1", seed: 1 as number | null, group: 1 as number | null, player: { id: "p1", name: "Іван" } },
  { playerId: "p2", seed: null as number | null, group: 1 as number | null, player: { id: "p2", name: "Петро" } },
  { playerId: "p3", seed: 1 as number | null, group: 2 as number | null, player: { id: "p3", name: "Олег" } },
  { playerId: "p4", seed: null as number | null, group: 2 as number | null, player: { id: "p4", name: "Данило" } },
];

function mockIndividualFixture() {
  getTournamentStandingsMock.mockResolvedValueOnce(
    new Map([
      ["p1", { playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0, winPct: 100, gamesWon: 12, gamesLost: 6, tournamentsPlayed: 1 }],
      ["p3", { playerId: "p3", matchesPlayed: 1, wins: 0, losses: 1, winPct: 0, gamesWon: 6, gamesLost: 12, tournamentsPlayed: 1 }],
      // p2/p4 intentionally absent - never played, should fall back to all-zero rows.
    ]),
  );
  prismaMock.match.findMany.mockResolvedValueOnce([
    {
      winnerSide: "A",
      players: [
        { side: "A", playerId: "p1" },
        { side: "B", playerId: "p3" },
      ],
      sets: [
        { sideAGames: 6, sideBGames: 4 },
        { sideAGames: 6, sideBGames: 2 },
      ],
    },
  ]);
}

describe("getTournamentStandingsRows (SINGLES/MIXED individual rows)", () => {
  it("fills in a zero row for a participant with no recorded stats", async () => {
    mockIndividualFixture();
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p2Row = result.rows.find((r) => r.key === "p2");
    expect(p2Row).toEqual(
      expect.objectContaining({ matchesPlayed: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0 }),
    );

    // The 2-set match (p1 beat p3 6-4, 6-2) awards 1 point per set won - p1 won both, p3 won neither.
    const p1Row = result.rows.find((r) => r.key === "p1");
    const p3Row = result.rows.find((r) => r.key === "p3");
    expect(p1Row).toEqual(expect.objectContaining({ points: 2 }));
    expect(p3Row).toEqual(expect.objectContaining({ points: 0 }));
  });

  it("uses a participant's nickname as the row label instead of their real name", async () => {
    mockIndividualFixture();
    const withNickname = participants.map((p) => ({
      ...p,
      seed: null,
      group: null,
      player: p.playerId === "p1" ? { ...p.player, nickname: "Ваня" } : p.player,
    }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", withNickname);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p1Row = result.rows.find((r) => r.key === "p1");
    expect(p1Row?.label).toBe("Ваня");
    const p2Row = result.rows.find((r) => r.key === "p2");
    expect(p2Row?.label).toBe("Петро");
  });

  it("awards the winner flat walkover points with no sets, while the withdrawn loser's row comes entirely from getTournamentStandings (already excludes the walkover loss - see player-stats.test.ts)", async () => {
    getTournamentStandingsMock.mockResolvedValueOnce(
      new Map([
        ["p1", { playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0, winPct: 100, gamesWon: 0, gamesLost: 0, tournamentsPlayed: 1 }],
        // p3 (withdrawn) has no entry - summarizePlayerStats excludes a
        // walkover loss from a player's own stats entirely.
      ]),
    );
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        winnerSide: "A",
        walkover: true,
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }],
        sets: [],
      },
    ]);
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p1Row = result.rows.find((r) => r.key === "p1");
    const p3Row = result.rows.find((r) => r.key === "p3");
    expect(p1Row).toEqual(expect.objectContaining({ wins: 1, matchesPlayed: 1, points: 2 }));
    expect(p3Row).toEqual(
      expect.objectContaining({ wins: 0, losses: 0, matchesPlayed: 0, points: 0 }),
    );
  });

  it("awards the winner flat points for a match retired before any set finished (empty sets, not a walkover)", async () => {
    // docs/CODE_REVIEW_2026-08-08.md: computeMatchPoints used to flatten an
    // empty `sets` array to {A:0,B:0} regardless of who the admin actually
    // picked as the winner via retiredWinnerSide - this is that scenario,
    // distinct from the walkover test above (walkover: false here).
    getTournamentStandingsMock.mockResolvedValueOnce(
      new Map([
        ["p1", { playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0, winPct: 100, gamesWon: 0, gamesLost: 0, tournamentsPlayed: 1 }],
        ["p2", { playerId: "p2", matchesPlayed: 1, wins: 0, losses: 1, winPct: 0, gamesWon: 0, gamesLost: 0, tournamentsPlayed: 1 }],
      ]),
    );
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        winnerSide: "A",
        walkover: false,
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [],
      },
    ]);
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p1Row = result.rows.find((r) => r.key === "p1");
    const p2Row = result.rows.find((r) => r.key === "p2");
    expect(p1Row).toEqual(expect.objectContaining({ points: 2 }));
    expect(p2Row).toEqual(expect.objectContaining({ points: 0 }));
  });

  it("excludes playoff matches from the plain individual table (shown above Підсумкова таблиця), even though placedTable still counts them", async () => {
    // No built-in groups here (a single implicit group) - p1 beat p2 in the
    // group stage AND again in Фінал. The plain "участники" table must show
    // 1 match each (group stage only); only Підсумкова таблиця counts both -
    // getTournamentStandings (mocked here) is tournament-wide by design, so
    // its numbers reflect both matches, same as production.
    getTournamentStandingsMock.mockResolvedValueOnce(
      new Map([
        ["p1", { playerId: "p1", matchesPlayed: 2, wins: 2, losses: 0, winPct: 100, gamesWon: 12, gamesLost: 6, tournamentsPlayed: 1 }],
        ["p2", { playerId: "p2", matchesPlayed: 2, wins: 0, losses: 2, winPct: 0, gamesWon: 6, gamesLost: 12, tournamentsPlayed: 1 }],
      ]),
    );
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: null, winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [{ sideAGames: 6, sideBGames: 4 }], walkover: false },
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [{ sideAGames: 6, sideBGames: 2 }], walkover: false },
    ]);
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p1Row = result.rows.find((r) => r.key === "p1");
    expect(p1Row).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1 }));

    expect(result.placedTable).toBeDefined();
    const placedP1 = result.placedTable!.rows.find((r) => r.key === "p1");
    expect(placedP1).toEqual(expect.objectContaining({ matchesPlayed: 2, wins: 2, place: 1 }));
  });

  it("splits into Gold/Silver when only seeding is used", async () => {
    mockIndividualFixture();
    const seedsOnly = participants.map((p) => ({ ...p, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", seedsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    // Only one split active -> no need to disambiguate with a title.
    expect(result.groupings[0].title).toBeNull();
    const [gold, silver] = result.groupings[0].groups;
    expect(gold.label).toBe("Gold (сіяні)");
    expect(gold.rows.map((r) => r.key).sort()).toEqual(["p1", "p3"]);
    expect(silver.label).toBe("Silver (несіяні)");
    expect(silver.rows.map((r) => r.key).sort()).toEqual(["p2", "p4"]);
    expect(result.formatRulesKind).toBe("SEEDED_SPLIT");
  });

  it("splits by admin-assigned group when 2+ groups are in use", async () => {
    mockIndividualFixture();
    const groupsOnly = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", groupsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Група B"]);
    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
  });

  it("does not treat a single group as a real split", async () => {
    mockIndividualFixture();
    const oneGroup = participants.map((p) => ({ ...p, seed: null, group: 1 }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", oneGroup);

    expect(result.mode).toBe("individual");
  });

  it("treats a single group alongside an ungrouped remainder as a real split (e.g. a group just added mid-tournament via \"Додати групу\")", async () => {
    mockIndividualFixture();
    const oneGroupSomeUngrouped = participants.map((p) => ({
      ...p,
      seed: null,
      group: p.playerId === "p1" || p.playerId === "p2" ? 5 : null,
    }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", oneGroupSomeUngrouped);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група E", "Без групи"]);
    expect(result.groupings[0].groups[0].rows.map((r) => r.key).sort()).toEqual(["p1", "p2"]);
    expect(result.groupings[0].groups[1].rows.map((r) => r.key).sort()).toEqual(["p3", "p4"]);
  });

  it("suppresses За сіяністю when groups are also in use - a group draw seeds one anchor per group, not a real Gold/Silver split", async () => {
    mockIndividualFixture();

    const result = await getTournamentStandingsRows("t1", "SINGLES", participants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual([null]);
  });

  it("shows a custom group alongside the built-in group split, with a player legally appearing in both", async () => {
    mockIndividualFixture();
    // p1 is in built-in Група A *and* the custom "Плейофф" group - membership
    // in a custom group never removes the built-in one (see createTournamentGroupAction).
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p3" }] },
    ]);
    const groupsOnly = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", groupsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual(["За групами", "Додаткові групи"]);
    const groupA = result.groupings[0].groups.find((g) => g.label === "Група A");
    expect(groupA?.rows.map((r) => r.key).sort()).toEqual(["p1", "p2"]);
    const playoff = result.groupings[1].groups[0];
    expect(playoff.label).toBe("Плейофф");
    expect(playoff.rows.map((r) => r.key).sort()).toEqual(["p1", "p3"]);
  });

  it("does not leak a player's group-stage result into a custom group they haven't played anyone from yet", async () => {
    // Fixture match is p1 (Група A) beating p3 (Група B) - unrelated to Плейофф.
    mockIndividualFixture();
    // p1 and p4 are both in "Плейофф" but never played each other.
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p4" }] },
    ]);
    const groupsOnly = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", groupsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const playoff = result.groupings[1].groups[0];
    expect(playoff.rows.map((r) => r.key).sort()).toEqual(["p1", "p4"]);
    // p1's real win (against p3, in the group stage) must not show up here.
    expect(playoff.rows.every((r) => r.matchesPlayed === 0 && r.wins === 0 && r.points === 0)).toBe(true);
  });

  it("awards the explicit winner full points for a retired match, both in the individual table and a custom group, even when the recorded set score would say otherwise", async () => {
    // p1 retires against p3 - the admin picked p3 as the winner (whoever
    // didn't retire), but the one set on record (2-6) happens to still show
    // p3 "winning" it too here, so this alone wouldn't catch a regression
    // back to deriving purely from sets. The real point: `retired: true`
    // must be the thing that decides it, not a coincidence of the score.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Плейофф",
        winnerSide: "B",
        retired: true,
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p3" },
        ],
        sets: [{ sideAGames: 2, sideBGames: 6 }],
      },
    ]);
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p3" }] },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const playoff = result.groupings[1].groups[0];
    const p3InPlayoff = playoff.rows.find((r) => r.key === "p3");
    expect(p3InPlayoff).toEqual(expect.objectContaining({ wins: 1, points: 2 }));
  });

  it("awards the explicit winner points for a retired match with a tied (0-0) recorded set", async () => {
    // A tied set has no set-winner at all - without the retired flag,
    // computeMatchPoints would give both sides 0 points despite a real,
    // recorded winner.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        winnerSide: "A",
        retired: true,
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p2" },
        ],
        sets: [{ sideAGames: 0, sideBGames: 0 }],
      },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p1Row = result.rows.find((r) => r.key === "p1");
    expect(p1Row).toEqual(expect.objectContaining({ points: 2 }));
  });

  it("does not let a curated playoff rematch between two group-mates inflate their built-in group's own stats", async () => {
    // p1 and p2 are both Група A - they play once in the group stage, then
    // meet again in a real playoff match (За 3 місце) later. Unlike a
    // custom "Додаткові групи" table (which requires an exact roundFilter
    // match), a built-in group has no single round to anchor to - but a
    // match whose round is a recognized *different* context (a curated
    // playoff round here) must still be excluded, or it double-counts.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        winnerSide: "A",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "За 3 місце",
        winnerSide: "B",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [{ sideAGames: 4, sideBGames: 6 }],
      },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupA = result.groupings[0].groups.find((g) => g.label === "Група A");
    const p1Row = groupA?.rows.find((r) => r.key === "p1");
    const p2Row = groupA?.rows.find((r) => r.key === "p2");
    expect(p1Row).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, losses: 0 }));
    expect(p2Row).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 0, losses: 1 }));
  });

  it("does not let a rematch between two group-mates under a different custom group's round inflate their built-in group's own stats", async () => {
    // p1 and p2 are both Група A AND both members of a custom "Плейофф"
    // group too - a match explicitly labeled for that custom group must
    // not count toward Група A's own table either.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        winnerSide: "A",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "Плейофф",
        winnerSide: "B",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [{ sideAGames: 4, sideBGames: 6 }],
      },
    ]);
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p2" }] },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupA = result.groupings.flatMap((g) => g.groups).find((g) => g.label === "Група A");
    const p1Row = groupA?.rows.find((r) => r.key === "p1");
    expect(p1Row).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, losses: 0 }));
  });

  it("does not leak a Плейофф match into the built-in group's own table (and vice versa)", async () => {
    // p1 beats p2 (both Група A - an internal group-stage match) *and*
    // separately beats p3 (a Плейофф match, p3 is outside Група A).
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        winnerSide: "A",
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p2" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
      {
        round: "Плейофф",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p3" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 1 }],
      },
    ]);
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p3" }] },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupA = result.groupings[0].groups.find((g) => g.label === "Група A");
    const p1InGroupA = groupA?.rows.find((r) => r.key === "p1");
    // p1's Група A record reflects only the internal win against p2 - the
    // Плейофф win against p3 (outside Група A) does not leak in.
    expect(p1InGroupA).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1 }));

    const playoff = result.groupings[1].groups[0];
    const p1InPlayoff = playoff.rows.find((r) => r.key === "p1");
    // And the reverse: p1's Плейофф record reflects only the Плейофф win
    // against p3 - the group-stage win against p2 does not leak in either.
    expect(p1InPlayoff).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1 }));
  });

  it("does not leak a built-in group match into a custom group even when BOTH its players are also custom-group members", async () => {
    // p1 and p2 already played each other inside Група A (round: "Група A").
    // Both are later also added to the custom "За 7 місце" group together -
    // unlike every other leak test above, this match's players are a *subset*
    // of the custom group's members too, so a player-membership-only filter
    // would (incorrectly) count it toward "За 7 місце" even though nobody
    // has actually played a "За 7 місце" match between them yet.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Група A",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p2" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 2 }],
      },
    ]);
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "За 7 місце", members: [{ playerId: "p1" }, { playerId: "p2" }] },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupA = result.groupings[0].groups.find((g) => g.label === "Група A");
    const p1InGroupA = groupA?.rows.find((r) => r.key === "p1");
    expect(p1InGroupA).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1 }));

    const customGroup = result.groupings[1].groups.find((g) => g.label === "За 7 місце");
    expect(customGroup?.rows.map((r) => r.key).sort()).toEqual(["p1", "p2"]);
    // Neither player has a "За 7 місце" match yet - the Група A result must not leak in.
    expect(customGroup?.rows.every((r) => r.matchesPlayed === 0 && r.wins === 0 && r.losses === 0)).toBe(
      true,
    );
  });

  it("excludes a walkover loss from a custom group's own matchesPlayed/losses while crediting the winner normally", async () => {
    // p1 beats p3 via walkover (p3 withdrew) inside the "Плейофф" custom group.
    prismaMock.match.findMany.mockResolvedValueOnce([
      {
        round: "Плейофф",
        winnerSide: "A",
        walkover: true,
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }],
        sets: [],
      },
    ]);
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Плейофф", members: [{ playerId: "p1" }, { playerId: "p3" }] },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const playoff = result.groupings[0].groups[0];
    expect(playoff.label).toBe("Плейофф");
    const p1Row = playoff.rows.find((r) => r.key === "p1");
    const p3Row = playoff.rows.find((r) => r.key === "p3");
    expect(p1Row).toEqual(expect.objectContaining({ matchesPlayed: 1, wins: 1, points: 2 }));
    expect(p3Row).toEqual(
      expect.objectContaining({ matchesPlayed: 0, wins: 0, losses: 0, points: 0 }),
    );
  });

  it("still shows a custom group with zero current members, as an empty section", async () => {
    // A group can legitimately exist with no roster yet - e.g. created just
    // to give matches a round to pick from the "Додаткові групи" section of
    // MatchDialog's Раунд picker, before anyone's been added as a member.
    // It must still show up under "Таблиця", not be silently hidden until
    // someone is.
    mockIndividualFixture();
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      { number: 7, name: "Порожня", members: [] },
    ]);
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const emptyGroup = result.groupings[0].groups.find((g) => g.label === "Порожня");
    expect(emptyGroup?.rows).toEqual([]);
  });
});

describe("getTournamentStandingsRows (general placedTable, no GROUPS_12_PLAYOFF)", () => {
  it("builds a placedTable from real decisive matches for a hand-run tournament with no mini-group", async () => {
    // p1/p2 in Група A, p3/p4 in Група B - a manually organized bracket
    // (Фінал + За 3 місце), not the specific GROUPS_12_PLAYOFF randomizer.
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p2" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p3")).toBe(2);
    expect(byKey.get("p2")).toBe(3);
    expect(byKey.get("p4")).toBe(4);
    expect(result.placedTable!.complete).toBe(true);
  });

  it("leaves a player's place undecided (not a round-robin guess) when no match decided it", async () => {
    // Only a Фінал was played - p3/p4 (За 3 місце never happened) stay
    // unplaced rather than being ranked against each other by group-stage
    // standings alone (they're in different, incomparable groups).
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [], walkover: false },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p3")).toBe(2);
    expect(byKey.get("p2")).toBeNull();
    expect(byKey.get("p4")).toBeNull();
    expect(result.placedTable!.complete).toBe(false);
  });

  it("does not build a placedTable when there are no decisive playoff matches at all", async () => {
    mockIndividualFixture();
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.placedTable).toBeUndefined();
  });

  it("reports formatRulesKind as CUSTOM_GROUPS (not GROUPS_12_PLAYOFF) for a hand-run tournament's built-in groups", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [], walkover: false },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
  });

  it("fills places from a custom placement group's own completed round robin, right after the decisive matches", async () => {
    // 8 players: Фінал + За 3 місце decide places 1-4; p5-p8 (all still
    // unplaced) play their own round robin under a custom "Група за 5-8
    // місце" - once it's complete, its own standings order fills 5-8, the
    // general counterpart to GROUPS_12_PLAYOFF's hardcoded 9-12 mini-group.
    const eightParticipants = Array.from({ length: 8 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: null as number | null,
        group: null as number | null,
        withdrawnAt: null as Date | null,
        player: { id, name: id },
      };
    });
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      {
        number: 7,
        name: "Група за 5-8 місце",
        members: [{ playerId: "p5" }, { playerId: "p6" }, { playerId: "p7" }, { playerId: "p8" }],
      },
    ]);
    const round = "Група за 5-8 місце";
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p3" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
      // p5 beats everyone, p6 beats p7/p8, p7 beats p8 - so p5>p6>p7>p8.
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p6" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p7" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p8" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p6" }, { side: "B", playerId: "p7" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p6" }, { side: "B", playerId: "p8" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p7" }, { side: "B", playerId: "p8" }], sets: [], walkover: false },
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", eightParticipants);

    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p2")).toBe(2);
    expect(byKey.get("p3")).toBe(3);
    expect(byKey.get("p4")).toBe(4);
    expect(byKey.get("p5")).toBe(5);
    expect(byKey.get("p6")).toBe(6);
    expect(byKey.get("p7")).toBe(7);
    expect(byKey.get("p8")).toBe(8);
    expect(result.placedTable!.complete).toBe(true);
    expect(result.formatRulesKind).toBeFalsy();
  });

  it("leaves a custom placement group's members unplaced while its own round robin is still incomplete", async () => {
    const eightParticipants = Array.from({ length: 8 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: null as number | null,
        group: null as number | null,
        withdrawnAt: null as Date | null,
        player: { id, name: id },
      };
    });
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      {
        number: 7,
        name: "Група за 5-8 місце",
        members: [{ playerId: "p5" }, { playerId: "p6" }, { playerId: "p7" }, { playerId: "p8" }],
      },
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p3" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
      // Only one of the six needed mini-group matches has been played.
      { round: "Група за 5-8 місце", winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p6" }], sets: [], walkover: false },
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", eightParticipants);

    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p4")).toBe(4);
    expect(byKey.get("p5")).toBeNull();
    expect(byKey.get("p6")).toBeNull();
    expect(byKey.get("p7")).toBeNull();
    expect(byKey.get("p8")).toBeNull();
    expect(result.placedTable!.complete).toBe(false);
  });

  it("places the still-active members of a custom group once THEY are done, even if a withdrawn member never got a match against them", async () => {
    // p8 withdrew before the admin ever created a match between p8 and
    // anyone else in "Група за 5-8 місце" - unlike GROUPS_12_PLAYOFF's
    // auto-generated mini-group, an ad hoc custom group has no guarantee
    // every pairing exists as a match before a withdrawal. p5/p6/p7 still
    // finish their own round robin among themselves and must get placed,
    // not be blocked forever by p8's missing head-to-head record.
    const eightParticipants = Array.from({ length: 8 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: null as number | null,
        group: null as number | null,
        withdrawnAt: id === "p8" ? new Date("2026-08-10") : (null as Date | null),
        player: { id, name: id },
      };
    });
    prismaMock.tournamentGroup.findMany.mockResolvedValueOnce([
      {
        number: 7,
        name: "Група за 5-8 місце",
        members: [{ playerId: "p5" }, { playerId: "p6" }, { playerId: "p7" }, { playerId: "p8" }],
      },
    ]);
    const round = "Група за 5-8 місце";
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p3" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
      // Only the three real p5/p6/p7 pairings exist - none involve p8.
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p6" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p7" }], sets: [], walkover: false },
      { round, winnerSide: "A", players: [{ side: "A", playerId: "p6" }, { side: "B", playerId: "p7" }], sets: [], walkover: false },
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", eightParticipants);

    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p4")).toBe(4);
    expect(byKey.get("p5")).toBe(5);
    expect(byKey.get("p6")).toBe(6);
    expect(byKey.get("p7")).toBe(7);
    expect(byKey.get("p8")).toBeNull();
    expect(result.placedTable!.complete).toBe(true);
  });

  it("places the leftover players who never reached playoffs off their own already-complete group-stage round robin", async () => {
    // Single 6-player group (no built-in group split, no custom "Група за
    // 5-6 місце") - Фінал + За 3 місце decide places 1-4, and p5/p6 already
    // played each other during the round robin, so they don't need a
    // dedicated placement match to rank 5th/6th between themselves.
    const sixParticipants = Array.from({ length: 6 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: null as number | null,
        group: null as number | null,
        withdrawnAt: null as Date | null,
        player: { id, name: id },
      };
    });
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p3" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
      // Group-stage match, no playoff round - p5 beat p6.
      { round: null, winnerSide: "A", players: [{ side: "A", playerId: "p5" }, { side: "B", playerId: "p6" }], sets: [], walkover: false },
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", sixParticipants);

    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p2")).toBe(2);
    expect(byKey.get("p3")).toBe(3);
    expect(byKey.get("p4")).toBe(4);
    expect(byKey.get("p5")).toBe(5);
    expect(byKey.get("p6")).toBe(6);
    expect(result.placedTable!.complete).toBe(true);
  });

  it("still leaves leftover players unplaced when they never actually played each other", async () => {
    // p5 and p6 both lost early (no Фінал/За 3 місце involvement) but never
    // played each other (different built-in groups, say) - no head-to-head
    // exists between them, so the leftover fallback must not guess an order.
    const sixParticipants = Array.from({ length: 6 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: null as number | null,
        group: null as number | null,
        withdrawnAt: null as Date | null,
        player: { id, name: id },
      };
    });
    prismaMock.match.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p3" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", sixParticipants);

    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p5")).toBeNull();
    expect(byKey.get("p6")).toBeNull();
    expect(result.placedTable!.complete).toBe(false);
  });
});

function playoff12Participants() {
  return Array.from({ length: 12 }, (_, i) => {
    const id = `p${i + 1}`;
    return { playerId: id, seed: null as number | null, group: null as number | null, player: { id, name: id } };
  });
}

/** A completed match for the "placed" table fixtures below - only the fields buildGroups12PlayoffTable's queries select. */
function decisiveMatch(round: string, winnerId: string, loserId: string) {
  return {
    round,
    winnerSide: "A" as const,
    players: [
      { side: "A" as const, playerId: winnerId },
      { side: "B" as const, playerId: loserId },
    ],
  };
}

function miniGroupMatch(winnerId: string, loserId: string, status: "COMPLETED" | "SCHEDULED" = "COMPLETED") {
  return {
    round: MINI_GROUP_ROUND,
    status,
    winnerSide: status === "COMPLETED" ? ("A" as const) : null,
    players: [
      { side: "A" as const, playerId: winnerId },
      { side: "B" as const, playerId: loserId },
    ],
    sets: status === "COMPLETED" ? [{ sideAGames: 6, sideBGames: 0 }] : [],
  };
}

describe("getTournamentStandingsRows (GROUPS_12_PLAYOFF combined table)", () => {
  it("attaches a placedTable (1-12) alongside the normal display once the whole bracket is decided", async () => {
    // Call order inside getTournamentStandingsRows for this format: (1)
    // getIndividualRows' own completed-matches query, (2) the mini-group
    // matches query, (3) the decisive-playoff-matches query.
    prismaMock.match.findMany.mockResolvedValueOnce([]); // (1) no bearing on `place`, only on each row's own stats
    prismaMock.match.findMany.mockResolvedValueOnce([
      // (2) p9 > p10 > p11 > p12, no ties - a clean round robin.
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p9", "p12"),
      miniGroupMatch("p10", "p11"),
      miniGroupMatch("p10", "p12"),
      miniGroupMatch("p11", "p12"),
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      // (3)
      decisiveMatch("Фінал", "p1", "p2"),
      decisiveMatch("За 3 місце", "p3", "p4"),
      decisiveMatch("За 5 місце", "p5", "p6"),
      decisiveMatch("За 7 місце", "p7", "p8"),
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", playoff12Participants());

    expect(result.placedTable).toBeDefined();
    const placedTable = result.placedTable!;
    expect(placedTable.complete).toBe(true);
    expect(placedTable.rows.map((r) => r.key)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12",
    ]);
    expect(placedTable.rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.formatRulesKind).toBe("GROUPS_12_PLAYOFF");
  });

  it("leaves undecided places null and complete:false while the bracket is still in progress", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      // Mini-group only half played - not a complete round robin yet.
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p9", "p12", "SCHEDULED"),
      miniGroupMatch("p10", "p11", "SCHEDULED"),
      miniGroupMatch("p10", "p12", "SCHEDULED"),
      miniGroupMatch("p11", "p12", "SCHEDULED"),
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      // За 7 місце not played yet - p7/p8 undecided.
      decisiveMatch("Фінал", "p1", "p2"),
      decisiveMatch("За 3 місце", "p3", "p4"),
      decisiveMatch("За 5 місце", "p5", "p6"),
    ]);

    const result = await getTournamentStandingsRows("t1", "SINGLES", playoff12Participants());

    expect(result.placedTable).toBeDefined();
    const placedTable = result.placedTable!;
    expect(placedTable.complete).toBe(false);
    const placeByKey = new Map(placedTable.rows.map((r) => [r.key, r.place]));
    expect(placeByKey.get("p1")).toBe(1);
    expect(placeByKey.get("p6")).toBe(6);
    expect(placeByKey.get("p7")).toBeNull();
    expect(placeByKey.get("p8")).toBeNull();
    expect(placeByKey.get("p9")).toBeNull();
    expect(placeByKey.get("p12")).toBeNull();
    // Undecided rows sort after every decided one.
    expect(placedTable.rows.slice(0, 6).map((r) => r.key)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("still reports complete:true when a withdrawn group-3rd-place finisher never gets a mini-group slot", async () => {
    // docs/CODE_REVIEW_2026-08-08.md / docs/GROUPS12_PLAYOFF.md "Відомі
    // обмеження": p12 was withdrawn before ever being decided as their
    // group's rank-3 finisher, so groupRankPlayer never filled their side of
    // MINI_AD/MINI_BD/MINI_CD - only p9/p10/p11 ever show up as real
    // MatchPlayer rows in the mini-group, a genuine 3-player round robin.
    prismaMock.match.findMany.mockResolvedValueOnce([]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      // p9 > p10 > p11, no ties - p12 never appears in any mini-group match.
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p10", "p11"),
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([
      decisiveMatch("Фінал", "p1", "p2"),
      decisiveMatch("За 3 місце", "p3", "p4"),
      decisiveMatch("За 5 місце", "p5", "p6"),
      decisiveMatch("За 7 місце", "p7", "p8"),
    ]);
    const withP12Withdrawn = playoff12Participants().map((p) =>
      p.playerId === "p12" ? { ...p, withdrawnAt: new Date("2026-01-01") } : p,
    );

    const result = await getTournamentStandingsRows("t1", "SINGLES", withP12Withdrawn);

    expect(result.placedTable).toBeDefined();
    const placedTable = result.placedTable!;
    // Complete despite p12 having no place - excluded from the check because
    // they're withdrawn, not because every row actually has a place.
    expect(placedTable.complete).toBe(true);
    const placeByKey = new Map(placedTable.rows.map((r) => [r.key, r.place]));
    expect(placeByKey.get("p9")).toBe(9);
    expect(placeByKey.get("p10")).toBe(10);
    expect(placeByKey.get("p11")).toBe(11);
    expect(placeByKey.get("p12")).toBeNull();
  });

  it("has no placedTable when there's no mini-group at all", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([]);
    prismaMock.match.findMany.mockResolvedValueOnce([]); // no matches with round === MINI_GROUP_ROUND

    const result = await getTournamentStandingsRows("t1", "SINGLES", playoff12Participants());

    expect(result.mode).toBe("individual");
    expect(result.placedTable).toBeUndefined();
    expect(MINI_GROUP_ROUND).toBe("Група за 9-12 місце");
  });

  it("adds the mini-group as a 5th table under За групами, and suppresses За сіяністю", async () => {
    // Realistic GROUPS_12_PLAYOFF roster shape: 4 groups of 3, 1 seed per group.
    const participants = Array.from({ length: 12 }, (_, i) => {
      const id = `p${i + 1}`;
      return {
        playerId: id,
        seed: i % 3 === 0 ? 1 : (null as number | null),
        group: (i % 4) + 1,
        player: { id, name: id },
      };
    });

    prismaMock.match.findMany.mockResolvedValueOnce([]); // (1)
    prismaMock.match.findMany.mockResolvedValueOnce([
      // (2) mini-group members here happen to be p9-p12, same as other tests.
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p9", "p12"),
      miniGroupMatch("p10", "p11"),
      miniGroupMatch("p10", "p12"),
      miniGroupMatch("p11", "p12"),
    ]);
    prismaMock.match.findMany.mockResolvedValueOnce([]); // (3) no decisive matches yet

    const result = await getTournamentStandingsRows("t1", "SINGLES", participants);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const byGroups = result.groupings.find((g) => g.title === "За групами" || g.title === null);
    expect(byGroups).toBeDefined();
    expect(byGroups!.groups.map((g) => g.label)).toEqual(["Група A", "Група B", "Група C", "Група D", MINI_GROUP_ROUND]);
    expect(result.groupings.some((g) => g.title === "За сіяністю")).toBe(false);
  });
});
