import { beforeEach, describe, expect, it, vi } from "vitest";

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

    expect(result.grouped).toBe(false);
    if (result.grouped) throw new Error("unreachable");
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

    expect(result.grouped).toBe(false);
    if (result.grouped) throw new Error("unreachable");
    const byKey = new Map(result.rows.map((r) => [r.key, r]));
    expect(byKey.get("a3+a4")).toEqual(expect.objectContaining({ points: 2 }));
    expect(byKey.get("a1+a2")).toEqual(expect.objectContaining({ points: 0 }));
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

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Група B"]);
    expect(result.groupings[0].groups[0].rows.map((r) => r.key).sort()).toEqual(["a1+a2", "a3+a4"]);
    expect(result.groupings[0].groups[1].rows.map((r) => r.key).sort()).toEqual(["a5+a6", "a7+a8"]);
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

    expect(result.grouped).toBe(false);
  });

  it("leaves a team out of every bracket when its two players are in different groups", async () => {
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

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    const allGroupedKeys = result.groupings[0].groups.flatMap((g) => g.rows.map((r) => r.key));
    expect(allGroupedKeys).not.toContain("a1+a2");
    expect(allGroupedKeys.sort()).toEqual(["a3+a4", "a5+a6"]);
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

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    const groups = result.groupings[0].groups;
    const groupFive = groups.find((g) => g.label === "Група E");
    expect(groupFive?.rows.map((r) => r.key).sort()).toEqual(["a1", "a2"]);
    expect(groupFive?.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
    const withoutGroup = groups.find((g) => g.label === "Без групи");
    expect(withoutGroup?.rows.map((r) => r.key)).toContain("a3+a4");
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

    expect(result.grouped).toBe(false);
    if (result.grouped) throw new Error("unreachable");
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

  it("splits into Gold/Silver when only seeding is used", async () => {
    mockIndividualFixture();
    const seedsOnly = participants.map((p) => ({ ...p, group: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", seedsOnly);

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    // Only one split active -> no need to disambiguate with a title.
    expect(result.groupings[0].title).toBeNull();
    const [gold, silver] = result.groupings[0].groups;
    expect(gold.label).toBe("Gold (сіяні)");
    expect(gold.rows.map((r) => r.key).sort()).toEqual(["p1", "p3"]);
    expect(silver.label).toBe("Silver (несіяні)");
    expect(silver.rows.map((r) => r.key).sort()).toEqual(["p2", "p4"]);
  });

  it("splits by admin-assigned group when 2+ groups are in use", async () => {
    mockIndividualFixture();
    const groupsOnly = participants.map((p) => ({ ...p, seed: null }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", groupsOnly);

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Група B"]);
  });

  it("does not treat a single group as a real split", async () => {
    mockIndividualFixture();
    const oneGroup = participants.map((p) => ({ ...p, seed: null, group: 1 }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", oneGroup);

    expect(result.grouped).toBe(false);
  });

  it("treats a single group alongside an ungrouped remainder as a real split (e.g. a group just added mid-tournament via \"Додати групу\")", async () => {
    mockIndividualFixture();
    const oneGroupSomeUngrouped = participants.map((p) => ({
      ...p,
      seed: null,
      group: p.playerId === "p1" || p.playerId === "p2" ? 5 : null,
    }));

    const result = await getTournamentStandingsRows("t1", "SINGLES", oneGroupSomeUngrouped);

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група E", "Без групи"]);
    expect(result.groupings[0].groups[0].rows.map((r) => r.key).sort()).toEqual(["p1", "p2"]);
    expect(result.groupings[0].groups[1].rows.map((r) => r.key).sort()).toEqual(["p3", "p4"]);
  });

  it("shows both groupings with disambiguating titles when groups and seeding are both used", async () => {
    mockIndividualFixture();

    const result = await getTournamentStandingsRows("t1", "SINGLES", participants);

    expect(result.grouped).toBe(true);
    if (!result.grouped) throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual(["За групами", "За сіяністю"]);
  });
});
