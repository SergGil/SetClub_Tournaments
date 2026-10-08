import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelMatch: { findMany: vi.fn() },
    padelRatingSnapshot: { findMany: vi.fn() },
    player: { findMany: vi.fn(async (): Promise<{ id: string }[]> => []) },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const { computeDoublesSetClubPointsMock } = vi.hoisted(() => ({ computeDoublesSetClubPointsMock: vi.fn() }));
vi.mock("@/lib/rating/setclub", () => ({ computeDoublesSetClubPoints: computeDoublesSetClubPointsMock }));

const { computeSinglesSetClubPointsMock } = vi.hoisted(() => ({ computeSinglesSetClubPointsMock: vi.fn() }));
vi.mock("@/lib/rating/setclub-singles", () => ({
  computeSinglesSetClubPoints: computeSinglesSetClubPointsMock,
}));

import {
  fetchPadelRatingMatchRows,
  getAllPadelRatingHistories,
  getPadelDoublesRatings,
  getPadelDoublesRatingsTrend,
  getPadelDoublesSetClubPoints,
  getPadelDoublesSetClubTrend,
  getPadelSetClubSeasons,
  getPadelSinglesRatings,
  getPadelSinglesRatingsTrend,
  getPadelSinglesSetClubPoints,
  getPadelSinglesSetClubTrend,
  getPadelUpsetWins,
  getPadelUpsetWinsByPlayer,
  getPlayerPadelRatingHistory,
  PADEL_ROLLING_SEASON,
} from "@/lib/rating/padel-ratings-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchPadelRatingMatchRows", () => {
  it("converts dates to epoch ms and marks each player seeded per their own tournament", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        tournamentId: "t1",
        tournament: {
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          participants: [
            { playerId: "p1", seed: 1 },
            { playerId: "p2", seed: null },
          ],
        },
        winnerSide: "A",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        round: null,
        players: [
          { side: "A", playerId: "p1" },
          { side: "B", playerId: "p2" },
          { side: "B", playerId: "p3" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 4 }],
      },
    ]);

    const [row] = await fetchPadelRatingMatchRows("SINGLES");

    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "COMPLETED",
          winnerSide: { not: null },
          matchType: "SINGLES",
          walkover: false,
          tournament: { isWomensOnly: false },
        },
      }),
    );
    expect(row.tournamentStartDate).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
    expect(row.createdAt).toBe(new Date("2026-01-02T00:00:00.000Z").getTime());
    expect(row.tournamentParticipantCount).toBe(2);
    expect(row.players).toEqual([
      { side: "A", playerId: "p1", seeded: true },
      { side: "B", playerId: "p2", seeded: false },
      { side: "B", playerId: "p3", seeded: false },
    ]);
  });
});

function tournamentMatch({
  id,
  tournamentId,
  startDate,
  winnerSide,
  players,
}: {
  id: string;
  tournamentId: string;
  startDate: string;
  winnerSide: "A" | "B";
  players: { side: "A" | "B"; playerId: string }[];
}) {
  return {
    id,
    tournamentId,
    tournament: { startDate: new Date(startDate), participants: [] },
    winnerSide,
    createdAt: new Date(startDate),
    round: null,
    players,
    sets: [{ sideAGames: 6, sideBGames: 1 }],
  };
}

const singlesMatch = (id: string, winnerSide: "A" | "B", createdAt: string) => ({
  id,
  tournamentId: "t1",
  tournament: { startDate: new Date("2026-01-01"), participants: [] },
  winnerSide,
  createdAt: new Date(createdAt),
  round: null,
  players: [
    { side: "A", playerId: "strong" },
    { side: "B", playerId: "weak" },
  ],
  sets: [{ sideAGames: 6, sideBGames: 1 }],
});

describe("getPadelSinglesRatings / getPadelDoublesRatings", () => {
  it("ranks singles players by conservative Glicko-2 rating, strongest first", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      singlesMatch("m1", "A", "2026-01-01"),
      singlesMatch("m2", "A", "2026-01-02"),
      singlesMatch("m3", "A", "2026-01-03"),
    ]);
    const result = await getPadelSinglesRatings();
    expect(result.map((r) => r.playerId)).toEqual(["strong", "weak"]);
  });

  it("ranks doubles players by conservative OpenSkill ordinal, strongest first", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        tournamentId: "t1",
        tournament: { startDate: new Date("2026-01-01"), participants: [] },
        winnerSide: "A",
        createdAt: new Date("2026-01-01"),
        round: null,
        players: [
          { side: "A", playerId: "s1" },
          { side: "A", playerId: "s2" },
          { side: "B", playerId: "w1" },
          { side: "B", playerId: "w2" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 1 }],
      },
    ]);
    const result = await getPadelDoublesRatings();
    const strongIds = result.slice(0, 2).map((r) => r.playerId).sort();
    expect(strongIds).toEqual(["s1", "s2"]);
  });
});

describe("getPlayerPadelRatingHistory", () => {
  it("scopes to one player/format, oldest first, and serializes asOfDate", async () => {
    prismaMock.padelRatingSnapshot.findMany.mockResolvedValueOnce([
      { tournamentId: "t1", asOfDate: new Date("2026-01-01T00:00:00.000Z"), rating: 1500, spread: 100 },
    ]);
    const result = await getPlayerPadelRatingHistory("p1", "SINGLES");
    expect(prismaMock.padelRatingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: "p1", matchType: "SINGLES", pool: "GENERAL" }, orderBy: { asOfDate: "asc" } }),
    );
    expect(result).toEqual([
      { tournamentId: "t1", asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500, spread: 100 },
    ]);
  });
});

describe("getPadelSetClubSeasons", () => {
  it("returns distinct calendar years with a completed match, newest first", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      singlesMatch("m1", "A", "2026-01-01"),
      { ...singlesMatch("m2", "A", "2026-01-01"), tournament: { startDate: new Date("2024-06-01"), participants: [] } },
      { ...singlesMatch("m3", "A", "2026-01-01"), tournament: { startDate: new Date("2025-06-01"), participants: [] } },
    ]);
    const result = await getPadelSetClubSeasons("SINGLES");
    expect(result).toEqual([2026, 2025, 2024]);
  });
});

describe("getPadelDoublesSetClubPoints / getPadelSinglesSetClubPoints", () => {
  it("only includes matches from the requested season", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m2025", "A", "2025-06-01"), tournament: { startDate: new Date("2025-06-01"), participants: [] } },
      { ...singlesMatch("m2026", "A", "2026-06-01"), tournament: { startDate: new Date("2026-06-01"), participants: [] } },
    ]);
    computeDoublesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getPadelDoublesSetClubPoints(2026);

    const seasonRows = computeDoublesSetClubPointsMock.mock.calls[0][0];
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0].id).toBe("m2026");
  });

  it("sorts by points desc, then tournaments played desc, then playerId as a stable tiebreak", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([singlesMatch("m1", "A", "2026-01-01")]);
    computeSinglesSetClubPointsMock.mockReturnValueOnce(
      new Map([
        ["zed", { playerId: "zed", points: 10, tournamentsPlayed: 1 }],
        ["amy", { playerId: "amy", points: 20, tournamentsPlayed: 2 }],
        ["bob", { playerId: "bob", points: 20, tournamentsPlayed: 3 }],
      ]),
    );

    const result = await getPadelSinglesSetClubPoints(2026);

    expect(result.map((r) => r.playerId)).toEqual(["bob", "amy", "zed"]);
  });
});

describe("getPadelDoublesSetClubPoints / getPadelSinglesSetClubPoints (PADEL_ROLLING_SEASON)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes a tournament well within the last 52 weeks and excludes one well outside it", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m-recent", "A", "2026-01-01"), tournament: { startDate: new Date("2026-01-01"), participants: [] } },
      { ...singlesMatch("m-old", "A", "2024-06-01"), tournament: { startDate: new Date("2024-06-01"), participants: [] } },
    ]);
    computeDoublesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getPadelDoublesSetClubPoints(PADEL_ROLLING_SEASON);

    const rollingRows = computeDoublesSetClubPointsMock.mock.calls[0][0];
    expect(rollingRows.map((r: { id: string }) => r.id)).toEqual(["m-recent"]);
  });

  it("does not filter by calendar year - a tournament from last December still counts if within 52 weeks", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m-dec", "A", "2025-12-01"), tournament: { startDate: new Date("2025-12-01"), participants: [] } },
    ]);
    computeSinglesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getPadelSinglesSetClubPoints(PADEL_ROLLING_SEASON);

    const rollingRows = computeSinglesSetClubPointsMock.mock.calls[0][0];
    expect(rollingRows.map((r: { id: string }) => r.id)).toEqual(["m-dec"]);
  });
});

describe("getPadelSinglesRatingsTrend / getPadelDoublesRatingsTrend", () => {
  it("queries singles matches and omits a debutant from the latest tournament, keeping earlier players", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m-old",
        tournamentId: "t-old",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "vet1" }, { side: "B", playerId: "vet2" }],
      }),
      tournamentMatch({
        id: "m-new",
        tournamentId: "t-new",
        startDate: "2026-02-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "vet1" }, { side: "B", playerId: "newbie" }],
      }),
    ]);

    const deltas = await getPadelSinglesRatingsTrend();

    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ matchType: "SINGLES" }) }),
    );
    expect(deltas.has("newbie")).toBe(false);
    expect(deltas.has("vet1")).toBe(true);
    expect(deltas.has("vet2")).toBe(true);
  });

  it("queries doubles matches and omits debutants from the latest tournament", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m-old",
        tournamentId: "t-old",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "v1" },
          { side: "A", playerId: "v2" },
          { side: "B", playerId: "v3" },
          { side: "B", playerId: "v4" },
        ],
      }),
      tournamentMatch({
        id: "m-new",
        tournamentId: "t-new",
        startDate: "2026-02-01",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "v1" },
          { side: "A", playerId: "v2" },
          { side: "B", playerId: "newbie1" },
          { side: "B", playerId: "newbie2" },
        ],
      }),
    ]);

    const deltas = await getPadelDoublesRatingsTrend();

    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ matchType: "DOUBLES" }) }),
    );
    expect(deltas.has("newbie1")).toBe(false);
    expect(deltas.has("newbie2")).toBe(false);
    expect(deltas.has("v1")).toBe(true);
    expect(deltas.has("v3")).toBe(true);
  });
});

describe("getPadelSinglesSetClubTrend / getPadelDoublesSetClubTrend", () => {
  it("diffs the season's current order against the order with its own latest tournament excluded", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m-old",
        tournamentId: "t-old",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "amy" }, { side: "B", playerId: "bob" }],
      }),
      tournamentMatch({
        id: "m-new",
        tournamentId: "t-new",
        startDate: "2026-02-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "bob" }, { side: "B", playerId: "amy" }],
      }),
    ]);
    computeSinglesSetClubPointsMock
      .mockReturnValueOnce(
        new Map([
          ["bob", { playerId: "bob", points: 20, tournamentsPlayed: 2 }],
          ["amy", { playerId: "amy", points: 10, tournamentsPlayed: 2 }],
        ]),
      )
      .mockReturnValueOnce(
        new Map([
          ["amy", { playerId: "amy", points: 10, tournamentsPlayed: 1 }],
          ["bob", { playerId: "bob", points: 5, tournamentsPlayed: 1 }],
        ]),
      );

    const deltas = await getPadelSinglesSetClubTrend(2026);

    expect(computeSinglesSetClubPointsMock.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual([
      "m-old",
      "m-new",
    ]);
    expect(computeSinglesSetClubPointsMock.mock.calls[1][0].map((r: { id: string }) => r.id)).toEqual(["m-old"]);
    expect(deltas.get("bob")).toBe(1);
    expect(deltas.get("amy")).toBe(-1);
  });

  it("excludes the latest tournament within the requested season only, not the club's all-time latest", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m-2023-a",
        tournamentId: "t-2023-a",
        startDate: "2023-01-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "amy" }, { side: "B", playerId: "bob" }],
      }),
      tournamentMatch({
        id: "m-2023-b",
        tournamentId: "t-2023-b",
        startDate: "2023-06-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "amy" }, { side: "B", playerId: "bob" }],
      }),
      tournamentMatch({
        id: "m-2026",
        tournamentId: "t-2026",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "amy" }, { side: "B", playerId: "bob" }],
      }),
    ]);
    computeSinglesSetClubPointsMock.mockReturnValue(new Map());

    await getPadelSinglesSetClubTrend(2023);

    const calls = computeSinglesSetClubPointsMock.mock.calls;
    expect(calls[0][0].map((r: { id: string }) => r.id)).toEqual(["m-2023-a", "m-2023-b"]);
    expect(calls[1][0].map((r: { id: string }) => r.id)).toEqual(["m-2023-a"]);
  });

  it("computes doubles Set Club deltas the same way", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m-old",
        tournamentId: "t-old",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "amy" },
          { side: "A", playerId: "amy2" },
          { side: "B", playerId: "bob" },
          { side: "B", playerId: "bob2" },
        ],
      }),
    ]);
    computeDoublesSetClubPointsMock
      .mockReturnValueOnce(new Map([["amy", { playerId: "amy", points: 10, tournamentsPlayed: 1 }]]))
      .mockReturnValueOnce(new Map());

    const deltas = await getPadelDoublesSetClubTrend(2026);

    expect(deltas.size).toBe(0);
  });
});

describe("women's pool (PadelTournament.isWomensOnly)", () => {
  it("filters to women-only padel tournaments when scope is 'women'", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([]);

    await fetchPadelRatingMatchRows("SINGLES", "women");

    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tournament: { isWomensOnly: true } }) }),
    );
  });

  it("hides a beginner male teammate's own row but still lets the match update his female partner's rating", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      tournamentMatch({
        id: "m1",
        tournamentId: "t1",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [
          { side: "A", playerId: "amy" },
          { side: "A", playerId: "male1" },
          { side: "B", playerId: "beth" },
          { side: "B", playerId: "cara" },
        ],
      }),
    ]);
    prismaMock.player.findMany.mockResolvedValueOnce([{ id: "amy" }, { id: "beth" }, { id: "cara" }]);

    const result = await getPadelDoublesRatings("women");

    const ids = result.map((r) => r.playerId);
    expect(ids).not.toContain("male1");
    expect(ids).toEqual(expect.arrayContaining(["amy", "beth", "cara"]));
    expect(result.find((r) => r.playerId === "amy")!.matchesPlayed).toBe(1);
  });

  it("returns no rating history for a player who isn't recorded as female, without querying snapshots", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([{ id: "amy" }]);

    const result = await getPlayerPadelRatingHistory("male1", "DOUBLES", "women");

    expect(result).toEqual([]);
    expect(prismaMock.padelRatingSnapshot.findMany).not.toHaveBeenCalled();
  });

  it("queries the WOMEN snapshot pool for a female player's history", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([{ id: "amy" }]);
    prismaMock.padelRatingSnapshot.findMany.mockResolvedValueOnce([]);

    await getPlayerPadelRatingHistory("amy", "DOUBLES", "women");

    expect(prismaMock.padelRatingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: "amy", matchType: "DOUBLES", pool: "WOMEN" } }),
    );
  });
});

describe("getPadelUpsetWins / getPadelUpsetWinsByPlayer", () => {
  const doublesMatch = (id: string, winners: [string, string], losers: [string, string]) =>
    tournamentMatch({
      id,
      tournamentId: "t1",
      startDate: "2026-01-01",
      winnerSide: "A",
      players: [
        { side: "A", playerId: winners[0] },
        { side: "A", playerId: winners[1] },
        { side: "B", playerId: losers[0] },
        { side: "B", playerId: losers[1] },
      ],
    });

  it("lists each decided match with its winners and the winner's pre-match win probability", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doublesMatch("m1", ["amy", "amy2"], ["bob", "bob2"])]);

    const upsets = await getPadelUpsetWins("DOUBLES");

    expect(upsets).toHaveLength(1);
    expect(upsets[0]).toMatchObject({ matchId: "m1", winnerIds: expect.arrayContaining(["amy", "amy2"]) });
    expect(upsets[0].winnerPreWinProb).toBeGreaterThan(0);
    expect(upsets[0].winnerPreWinProb).toBeLessThan(1);
  });

  it("replays singles through the singles engine", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([singlesMatch("m1", "A", "2026-01-01")]);
    const upsets = await getPadelUpsetWins("SINGLES");
    expect(upsets.map((u) => u.winnerIds)).toEqual([["strong"]]);
  });

  it("in the women's pool keeps only female winners, and drops a match left with none", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doublesMatch("m1", ["amy", "mike"], ["bob", "bob2"]),
      doublesMatch("m2", ["mike", "bob"], ["amy", "amy2"]),
    ]);
    prismaMock.player.findMany.mockResolvedValue([{ id: "amy" }, { id: "amy2" }]);

    const upsets = await getPadelUpsetWins("DOUBLES", "women");

    expect(upsets.map((u) => u.matchId)).toEqual(["m1"]);
    expect(upsets[0].winnerIds).toEqual(["amy"]);
    prismaMock.player.findMany.mockResolvedValue([]);
  });

  it("indexes each upset under every winner's id, and only winners", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doublesMatch("m1", ["amy", "amy2"], ["bob", "bob2"])]);

    const byPlayer = await getPadelUpsetWinsByPlayer("DOUBLES");

    expect(byPlayer.amy).toHaveLength(1);
    expect(byPlayer.amy2).toHaveLength(1);
    expect(byPlayer.amy[0].matchId).toBe("m1");
    expect(byPlayer.bob).toBeUndefined();
    expect(byPlayer.bob2).toBeUndefined();
  });

  it("collects several wins by the same player in match order", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      doublesMatch("m1", ["amy", "amy2"], ["bob", "bob2"]),
      doublesMatch("m2", ["amy", "amy2"], ["cat", "cat2"]),
    ]);
    const byPlayer = await getPadelUpsetWinsByPlayer("DOUBLES");
    expect(byPlayer.amy.map((u) => u.matchId)).toEqual(["m1", "m2"]);
  });
});

describe("getAllPadelRatingHistories", () => {
  const snapshot = (playerId: string, asOfDate: string, rating: number) => ({
    playerId,
    tournamentId: "t1",
    asOfDate: new Date(asOfDate),
    rating,
    spread: 80,
  });

  it("groups the snapshot rows per player, oldest first, with ISO dates and no playerId on the points", async () => {
    prismaMock.padelRatingSnapshot.findMany.mockResolvedValueOnce([
      snapshot("p1", "2026-01-01T00:00:00.000Z", 1500),
      snapshot("p2", "2026-01-01T00:00:00.000Z", 1400),
      snapshot("p1", "2026-02-01T00:00:00.000Z", 1520),
    ]);

    const result = await getAllPadelRatingHistories("SINGLES");

    expect(Object.keys(result).sort()).toEqual(["p1", "p2"]);
    expect(result.p1).toEqual([
      { tournamentId: "t1", asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500, spread: 80 },
      { tournamentId: "t1", asOfDate: "2026-02-01T00:00:00.000Z", rating: 1520, spread: 80 },
    ]);
    expect(prismaMock.padelRatingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { asOfDate: "asc" }, where: expect.objectContaining({ matchType: "SINGLES" }) }),
    );
  });

  it("in the women's pool drops a non-female player's rows even though the snapshot table has them", async () => {
    prismaMock.padelRatingSnapshot.findMany.mockResolvedValueOnce([
      snapshot("amy", "2026-01-01T00:00:00.000Z", 1500),
      snapshot("male1", "2026-01-01T00:00:00.000Z", 1500),
    ]);
    prismaMock.player.findMany.mockResolvedValueOnce([{ id: "amy" }]);

    const result = await getAllPadelRatingHistories("DOUBLES", "women");

    expect(Object.keys(result)).toEqual(["amy"]);
  });

  it("returns an empty object when there are no snapshots", async () => {
    prismaMock.padelRatingSnapshot.findMany.mockResolvedValueOnce([]);
    expect(await getAllPadelRatingHistories("SINGLES")).toEqual({});
  });
});
