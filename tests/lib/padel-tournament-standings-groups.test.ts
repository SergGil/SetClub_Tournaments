import { beforeEach, describe, expect, it, vi } from "vitest";

// Second half of the padel standings suite (see padel-tournament-standings.test.ts for the
// representative wiring checks): the grouped layouts - admin-assigned groups, the "Без групи"
// remainder, custom "Додаткові групи" rounds and team placement - for DOUBLES and SINGLES.

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { padelMatch: { findMany: vi.fn() }, padelTournamentGroup: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { getPadelTournamentStandingsMock } = vi.hoisted(() => ({ getPadelTournamentStandingsMock: vi.fn() }));
vi.mock("@/lib/padel-stats", () => ({ getPadelTournamentStandings: getPadelTournamentStandingsMock }));

import { getPadelTournamentStandingsRows } from "@/lib/padel-tournament-standings";

type Side = "A" | "B";

function player(id: string, side: Side) {
  return { side, playerId: id, player: { name: id, nickname: null } };
}

/** A completed (or otherwise-statused) doubles match: `a` and `b` are the two pairs. */
function doubles(
  a: [string, string],
  b: [string, string],
  opts: { round?: string | null; winner?: Side | null; status?: string; sets?: [number, number][] } = {},
) {
  const { round = null, winner = "A", status = "COMPLETED", sets = [[6, 2]] } = opts;
  return {
    round,
    status,
    winnerSide: winner,
    retired: false,
    players: [...a.map((id) => player(id, "A")), ...b.map((id) => player(id, "B"))],
    sets: sets.map(([sideAGames, sideBGames]) => ({ sideAGames, sideBGames })),
  };
}

function entry(playerId: string, group: number | null, seed: number | null = null) {
  return { playerId, seed, group, player: { id: playerId, name: playerId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelMatch.findMany.mockResolvedValue([]);
  prismaMock.padelTournamentGroup.findMany.mockResolvedValue([]);
  getPadelTournamentStandingsMock.mockResolvedValue(new Map());
});

describe("DOUBLES with admin-assigned groups", () => {
  const groupedPlayers = [
    entry("a1", 1),
    entry("a2", 1),
    entry("a3", 1),
    entry("a4", 1),
    entry("b1", 2),
    entry("b2", 2),
  ];

  it("splits teams by the group both partners belong to, labelled Група A / Група B", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doubles(["a1", "a2"], ["a3", "a4"])]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", groupedPlayers);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
    // one grouping only -> its title is dropped
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Група B"]);

    const groupA = result.groupings[0].groups[0];
    expect(groupA.rows.map((r) => r.key)).toEqual(["a1+a2", "a3+a4"]);
    expect(groupA.rows[0]).toMatchObject({ wins: 1, losses: 0, gamesWon: 6, gamesLost: 2, points: 2 });
  });

  it("shows partners nobody has paired yet as 0-0 placeholder rows linking to their padel profile", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doubles(["a1", "a2"], ["a3", "a4"])]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", groupedPlayers);

    if (result.mode !== "grouped") throw new Error("unreachable");
    const groupB = result.groupings[0].groups[1];
    expect(groupB.rows.map((r) => r.key).sort()).toEqual(["b1", "b2"]);
    expect(groupB.rows[0]).toMatchObject({ matchesPlayed: 0, wins: 0, points: 0 });
    expect(groupB.rows.find((r) => r.key === "b1")?.href).toBe("/padel/players/b1");
    expect(groupB.roundRobinDone).toBe(false);
  });

  it("adds a 'Без групи' bucket for teams made only of players without a group", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"]),
      doubles(["c1", "c2"], ["c3", "c4"], { winner: "B" }),
    ]);
    const players = [
      entry("a1", 1),
      entry("a2", 1),
      entry("a3", 1),
      entry("a4", 1),
      entry("c1", null),
      entry("c2", null),
      entry("c3", null),
      entry("c4", null),
    ];

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", players);

    if (result.mode !== "grouped") throw new Error("unreachable");
    const labels = result.groupings[0].groups.map((g) => g.label);
    expect(labels).toEqual(["Група A", "Без групи"]);
    const ungrouped = result.groupings[0].groups[1];
    expect(ungrouped.rows[0].key).toBe("c3+c4"); // winner (side B) sorts first
    expect(ungrouped.rows[0].wins).toBe(1);
  });

  it("keeps a match between teams from different groups out of both group tables", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doubles(["a1", "a2"], ["b1", "b2"])]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", groupedPlayers);

    if (result.mode !== "grouped") throw new Error("unreachable");
    for (const group of result.groupings[0].groups) {
      expect(group.rows.every((r) => r.matchesPlayed === 0)).toBe(true);
    }
  });
});

describe("DOUBLES without groups", () => {
  it("is a single individual table of teams that leaves playoff rounds out", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"]),
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Фінал" }),
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("individual");
    if (result.mode !== "individual") throw new Error("unreachable");
    expect(result.rows.find((r) => r.key === "a1+a2")).toMatchObject({ matchesPlayed: 1, wins: 1 });
    expect(result.roundRobinDone).toBe(true);
    expect(result.formatRulesKind).toBeUndefined();
  });

  it("counts a team whose only match hasn't been played as 0 matches", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"], { status: "SCHEDULED", winner: null, sets: [] }),
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    if (result.mode !== "individual") throw new Error("unreachable");
    expect(result.rows.every((r) => r.matchesPlayed === 0 && r.points === 0)).toBe(true);
    expect(result.roundRobinDone).toBe(false);
  });
});

describe("DOUBLES team placement from decisive rounds", () => {
  it("places finalists, third-place teams and appends everyone else after them", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Фінал" }),
      doubles(["b1", "b2"], ["c1", "c2"], { round: "За 3 місце" }),
      doubles(["d1", "d2"], ["e1", "e2"]), // group-stage only
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.placedTable).toBeDefined();
    const place = new Map(result.placedTable!.rows.map((r) => [r.key, r.place]));
    expect(place.get("a1+a2")).toBe(1);
    expect(place.get("a3+a4")).toBe(2);
    expect(place.get("b1+b2")).toBe(3);
    expect(place.get("c1+c2")).toBe(4);
    // the two group-stage-only teams follow, best (the winner) first
    expect(place.get("d1+d2")).toBe(5);
    expect(place.get("e1+e2")).toBe(6);
    expect(result.placedTable!.complete).toBe(true);
    // sorted by place
    expect(result.placedTable!.rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("builds no placement table when nothing decisive has been played", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doubles(["a1", "a2"], ["a3", "a4"])]);
    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);
    expect(result.placedTable).toBeUndefined();
  });

  it("ignores an unfinished decisive match", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Фінал", status: "SCHEDULED", winner: null, sets: [] }),
    ]);
    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);
    expect(result.placedTable).toBeUndefined();
  });
});

describe("custom 'Додаткові групи' (admin-created round groups)", () => {
  const customGroup = {
    id: "cg1",
    number: 1,
    name: "Плей-аут",
    members: [{ playerId: "a1" }, { playerId: "a2" }, { playerId: "a3" }, { playerId: "a4" }],
  };

  it("DOUBLES: scopes a custom group to its own round and returns it as the only (untitled) grouping", async () => {
    prismaMock.padelTournamentGroup.findMany.mockResolvedValueOnce([customGroup]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Плей-аут" }),
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Плей-аут", winner: "B" }),
      doubles(["a1", "a2"], ["a3", "a4"], { round: null }), // plain round-robin: not this group's
    ]);

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", []);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings).toHaveLength(1);
    expect(result.groupings[0].title).toBeNull();
    const group = result.groupings[0].groups[0];
    expect(group).toMatchObject({ label: "Плей-аут", id: "cg1" });
    expect(group.rows.find((r) => r.key === "a1+a2")).toMatchObject({ matchesPlayed: 2, wins: 1, losses: 1 });
    expect(result.formatRulesKind).toBeUndefined();
  });

  it("DOUBLES: shows built-in groups and custom groups as two titled groupings", async () => {
    prismaMock.padelTournamentGroup.findMany.mockResolvedValueOnce([customGroup]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doubles(["a1", "a2"], ["a3", "a4"]),
      doubles(["a1", "a2"], ["a3", "a4"], { round: "Плей-аут" }),
    ]);
    const players = [entry("a1", 1), entry("a2", 1), entry("a3", 1), entry("a4", 1), entry("b1", 2), entry("b2", 2)];

    const result = await getPadelTournamentStandingsRows("t1", "DOUBLES", players);

    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual(["За групами", "Додаткові групи"]);
    expect(result.formatRulesKind).toBe("CUSTOM_GROUPS");
  });

  it("SINGLES: lists a custom group scoped to its round", async () => {
    prismaMock.padelTournamentGroup.findMany.mockResolvedValueOnce([
      { id: "cg1", number: 1, name: "Доп", members: [{ playerId: "p1" }, { playerId: "p2" }] },
    ]);
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        round: "Доп",
        winnerSide: "A",
        retired: false,
        walkover: false,
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
        sets: [{ sideAGames: 6, sideBGames: 3 }],
      },
    ]);
    const players = [entry("p1", null), entry("p2", null), entry("p3", null)];

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", players);

    expect(result.mode).toBe("grouped");
    if (result.mode !== "grouped") throw new Error("unreachable");
    const group = result.groupings[0].groups[0];
    expect(group).toMatchObject({ label: "Доп", id: "cg1" });
    expect(group.rows.map((r) => r.key)).toEqual(["p1", "p2"]);
    expect(group.rows[0]).toMatchObject({ wins: 1, gamesWon: 6, gamesLost: 3 });
  });

  it("SINGLES: built-in groups plus custom groups give two titled groupings, with the 'Без групи' remainder", async () => {
    prismaMock.padelTournamentGroup.findMany.mockResolvedValueOnce([
      { id: "cg1", number: 1, name: "Доп", members: [{ playerId: "p1" }, { playerId: "p2" }] },
    ]);
    const players = [entry("p1", 1), entry("p2", 1), entry("p3", null)];

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", players);

    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings.map((g) => g.title)).toEqual(["За групами", "Додаткові групи"]);
    // custom group #1's name is also what built-in group #1 is called (names are keyed by number)
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Доп", "Без групи"]);
  });

  it("SINGLES: uses the custom group's name for a built-in group number that has one", async () => {
    prismaMock.padelTournamentGroup.findMany.mockResolvedValueOnce([
      { id: "cg2", number: 2, name: "Золота", members: [] },
    ]);
    const players = [entry("p1", 1), entry("p2", 2)];

    const result = await getPadelTournamentStandingsRows("t1", "SINGLES", players);

    if (result.mode !== "grouped") throw new Error("unreachable");
    expect(result.groupings[0].groups.map((g) => g.label)).toEqual(["Група A", "Золота"]);
  });
});
