import { beforeEach, describe, expect, it, vi } from "vitest";

import { MINI_GROUP_ROUND } from "@/lib/playoff-rounds";

// Representative coverage, not a full mirror of tournament-standings.test.ts
// (1711 lines) - this file is a byte-for-byte port of tournament-standings.ts
// (only Prisma model names / function names changed, verified via tsc), so
// the algorithm itself is already proven correct by that file's full test
// suite. These tests exist to catch a wiring mistake (wrong model, wrong
// field) in the port, one representative case per major branch.

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { padelMatch: { findMany: vi.fn() }, padelTournamentGroup: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { getPadelTournamentStandingsMock } = vi.hoisted(() => ({ getPadelTournamentStandingsMock: vi.fn() }));
vi.mock("@/lib/padel-stats", () => ({ getPadelTournamentStandings: getPadelTournamentStandingsMock }));

import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelMatch.findMany.mockResolvedValue([]);
  prismaMock.padelTournamentGroup.findMany.mockResolvedValue([]);
  getPadelTournamentStandingsMock.mockResolvedValue(new Map());
});

describe("getPadelTournamentStandingsRows (DOUBLES)", () => {
  it("groups by the exact pair that played together, counting games/wins only from completed matches", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        status: "COMPLETED",
        winnerSide: "A",
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
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const byKey = new Map(result.rows.map((r) => [r.key, r]));
    expect(byKey.get("a1+a2")).toEqual(
      expect.objectContaining({ label: "Іван / Петро", matchesPlayed: 1, wins: 1, gamesWon: 12, gamesLost: 6, points: 2 }),
    );
    expect(byKey.get("a3+a4")).toEqual(
      expect.objectContaining({ wins: 0, losses: 1, gamesWon: 6, gamesLost: 12, points: 0 }),
    );
  });

  it("builds a placedTable from a custom 'N-M місце' team mini-group round robin, with no curated decisive matches at all", async () => {
    const team = (id: string, side: "A" | "B") => ({ side, playerId: id, player: { name: id } });
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        round: "Ігри за 1-3 місце", status: "COMPLETED", winnerSide: "A",
        players: [team("a1", "A"), team("a2", "A"), team("a3", "B"), team("a4", "B")],
        sets: [{ sideAGames: 6, sideBGames: 0 }],
      },
      {
        round: "Ігри за 1-3 місце", status: "COMPLETED", winnerSide: "A",
        players: [team("a1", "A"), team("a2", "A"), team("a5", "B"), team("a6", "B")],
        sets: [{ sideAGames: 6, sideBGames: 0 }],
      },
      {
        round: "Ігри за 1-3 місце", status: "COMPLETED", winnerSide: "A",
        players: [team("a3", "A"), team("a4", "A"), team("a5", "B"), team("a6", "B")],
        sets: [{ sideAGames: 6, sideBGames: 0 }],
      },
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("a1+a2")).toBe(1);
    expect(byKey.get("a3+a4")).toBe(2);
    expect(byKey.get("a5+a6")).toBe(3);
    expect(result.placedTable!.complete).toBe(true);
  });
});

const participants = [
  { playerId: "p1", seed: 1 as number | null, group: 1 as number | null, player: { id: "p1", name: "Іван" } },
  { playerId: "p2", seed: null as number | null, group: 1 as number | null, player: { id: "p2", name: "Петро" } },
  { playerId: "p3", seed: 1 as number | null, group: 2 as number | null, player: { id: "p3", name: "Олег" } },
  { playerId: "p4", seed: null as number | null, group: 2 as number | null, player: { id: "p4", name: "Данило" } },
];

function mockIndividualFixture() {
  getPadelTournamentStandingsMock.mockResolvedValueOnce(
    new Map([
      ["p1", { playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0, winPct: 100, gamesWon: 12, gamesLost: 6, tournamentsPlayed: 1 }],
      ["p3", { playerId: "p3", matchesPlayed: 1, wins: 0, losses: 1, winPct: 0, gamesWon: 6, gamesLost: 12, tournamentsPlayed: 1 }],
    ]),
  );
  prismaMock.padelMatch.findMany.mockResolvedValueOnce([
    {
      winnerSide: "A",
      players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }],
      sets: [{ sideAGames: 6, sideBGames: 4 }, { sideAGames: 6, sideBGames: 2 }],
    },
  ]);
}

describe("getPadelTournamentStandingsRows (SINGLES/MIXED individual rows)", () => {
  it("fills in a zero row for a participant with no recorded stats", async () => {
    mockIndividualFixture();
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    const p2Row = result.rows.find((r) => r.key === "p2");
    expect(p2Row).toEqual(
      expect.objectContaining({ matchesPlayed: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0 }),
    );
  });

  it("excludes playoff matches from the plain individual table, even though placedTable still counts them", async () => {
    getPadelTournamentStandingsMock.mockResolvedValueOnce(
      new Map([
        ["p1", { playerId: "p1", matchesPlayed: 2, wins: 2, losses: 0, winPct: 100, gamesWon: 12, gamesLost: 6, tournamentsPlayed: 1 }],
        ["p2", { playerId: "p2", matchesPlayed: 2, wins: 0, losses: 2, winPct: 0, gamesWon: 6, gamesLost: 12, tournamentsPlayed: 1 }],
      ]),
    );
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { round: null, winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [{ sideAGames: 6, sideBGames: 4 }], walkover: false },
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [{ sideAGames: 6, sideBGames: 2 }], walkover: false },
    ]);
    const noGroupsOrSeeds = participants.map((p) => ({ ...p, seed: null, group: null }));

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", noGroupsOrSeeds);

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

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", seedsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
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

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", groupsOnly);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupLabels = result.groupings[0].groups.map((g) => g.label);
    expect(groupLabels).toEqual(["Група A", "Група B"]);
    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
  });
});

describe("getPadelTournamentStandingsRows (general placedTable, no GROUPS_12_PLAYOFF)", () => {
  it("builds a placedTable from real decisive matches for a hand-run tournament", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { round: "Фінал", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [], walkover: false },
      { round: "За 3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p2" }, { side: "B", playerId: "p4" }], sets: [], walkover: false },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p3")).toBe(2);
    expect(byKey.get("p2")).toBe(3);
    expect(byKey.get("p4")).toBe(4);
    expect(result.placedTable!.complete).toBe(true);
  });

  it("does not build a placedTable when there are no decisive playoff matches at all", async () => {
    mockIndividualFixture();
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.placedTable).toBeUndefined();
  });

  it("builds a placedTable from a custom 'N-M місце' mini-group round robin, with no curated decisive matches at all", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { round: "Ігри за 1-3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [{ sideAGames: 6, sideBGames: 0 }], walkover: false },
      { round: "Ігри за 1-3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [{ sideAGames: 6, sideBGames: 0 }], walkover: false },
      { round: "Ігри за 1-3 місце", winnerSide: "A", players: [{ side: "A", playerId: "p2" }, { side: "B", playerId: "p3" }], sets: [{ sideAGames: 6, sideBGames: 0 }], walkover: false },
    ]);
    const fixture = participants.map((p) => ({ ...p, seed: null }));

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", fixture);

    expect(result.placedTable).toBeDefined();
    const byKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(byKey.get("p1")).toBe(1);
    expect(byKey.get("p2")).toBe(2);
    expect(byKey.get("p3")).toBe(3);
    expect(byKey.get("p4")).toBe(4);
    expect(result.placedTable!.complete).toBe(true);
  });
});

function playoff12Participants() {
  return Array.from({ length: 12 }, (_, i) => {
    const id = `p${i + 1}`;
    return { playerId: id, seed: null as number | null, group: null as number | null, player: { id, name: id } };
  });
}

function decisiveMatch(round: string, winnerId: string, loserId: string) {
  return {
    round,
    winnerSide: "A" as const,
    players: [{ side: "A" as const, playerId: winnerId }, { side: "B" as const, playerId: loserId }],
  };
}

function miniGroupMatch(winnerId: string, loserId: string, status: "COMPLETED" | "SCHEDULED" = "COMPLETED") {
  return {
    round: MINI_GROUP_ROUND,
    status,
    winnerSide: status === "COMPLETED" ? ("A" as const) : null,
    players: [{ side: "A" as const, playerId: winnerId }, { side: "B" as const, playerId: loserId }],
    sets: status === "COMPLETED" ? [{ sideAGames: 6, sideBGames: 0 }] : [],
  };
}

describe("getPadelTournamentStandingsRows (GROUPS_12_PLAYOFF combined table)", () => {
  it("attaches a placedTable (1-12) alongside the normal display once the whole bracket is decided", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p9", "p12"),
      miniGroupMatch("p10", "p11"),
      miniGroupMatch("p10", "p12"),
      miniGroupMatch("p11", "p12"),
    ]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      decisiveMatch("Фінал", "p1", "p2"),
      decisiveMatch("За 3 місце", "p3", "p4"),
      decisiveMatch("За 5 місце", "p5", "p6"),
      decisiveMatch("За 7 місце", "p7", "p8"),
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", playoff12Participants());

    expect(result.placedTable).toBeDefined();
    const placedTable = result.placedTable!;
    expect(placedTable.complete).toBe(true);
    expect(placedTable.rows.map((r) => r.key)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12",
    ]);
    expect(result.formatRulesKind).toBe("GROUPS_12_PLAYOFF");
  });

  it("leaves undecided places null and complete:false while the bracket is still in progress", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      miniGroupMatch("p9", "p10"),
      miniGroupMatch("p9", "p11"),
      miniGroupMatch("p9", "p12", "SCHEDULED"),
      miniGroupMatch("p10", "p11", "SCHEDULED"),
      miniGroupMatch("p10", "p12", "SCHEDULED"),
      miniGroupMatch("p11", "p12", "SCHEDULED"),
    ]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      decisiveMatch("Фінал", "p1", "p2"),
      decisiveMatch("За 3 місце", "p3", "p4"),
      decisiveMatch("За 5 місце", "p5", "p6"),
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", playoff12Participants());

    expect(result.placedTable).toBeDefined();
    expect(result.placedTable!.complete).toBe(false);
    const placeByKey = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(placeByKey.get("p1")).toBe(1);
    expect(placeByKey.get("p7")).toBeNull();
    expect(placeByKey.get("p9")).toBeNull();
  });
});
