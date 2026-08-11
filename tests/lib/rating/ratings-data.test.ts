import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { match: { findMany: vi.fn() }, ratingSnapshot: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/cache", () => ({
  // ratings-data.ts wraps its queries in this - stub it as a passthrough so
  // the wrapped function is directly callable, same shape it'd have live.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const { computeDoublesSetClubPointsMock } = vi.hoisted(() => ({ computeDoublesSetClubPointsMock: vi.fn() }));
vi.mock("@/lib/rating/setclub", () => ({ computeDoublesSetClubPoints: computeDoublesSetClubPointsMock }));

const { computeSinglesSetClubPointsMock } = vi.hoisted(() => ({ computeSinglesSetClubPointsMock: vi.fn() }));
vi.mock("@/lib/rating/setclub-singles", () => ({
  computeSinglesSetClubPoints: computeSinglesSetClubPointsMock,
}));

import {
  fetchRatingMatchRows,
  getDoublesRatings,
  getDoublesRatingsTrend,
  getDoublesSetClubPoints,
  getDoublesSetClubTrend,
  getPlayerRatingHistory,
  getSetClubSeasons,
  getSinglesRatings,
  getSinglesRatingsTrend,
  getSinglesSetClubPoints,
  getSinglesSetClubTrend,
  ROLLING_SEASON,
} from "@/lib/rating/ratings-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchRatingMatchRows", () => {
  it("converts dates to epoch ms and marks each player seeded per their own tournament", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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
          // A player with no matching tournament participant row - shouldn't crash, just unseeded.
          { side: "B", playerId: "p3" },
        ],
        sets: [{ sideAGames: 6, sideBGames: 4 }],
      },
    ]);

    const [row] = await fetchRatingMatchRows("SINGLES");

    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COMPLETED", winnerSide: { not: null }, matchType: "SINGLES", walkover: false },
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

// Unlike singlesMatch below (fixed to a single "t1"), these tests need
// several distinct tournaments (with distinct start dates) in the same
// fetchRatingMatchRows result, to exercise excludeLatestTournament's
// "which tournament is latest" logic.
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

describe("getSinglesRatings / getDoublesRatings", () => {
  it("ranks singles players by conservative Glicko-2 rating, strongest first", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      singlesMatch("m1", "A", "2026-01-01"),
      singlesMatch("m2", "A", "2026-01-02"),
      singlesMatch("m3", "A", "2026-01-03"),
    ]);
    const result = await getSinglesRatings();
    expect(result.map((r) => r.playerId)).toEqual(["strong", "weak"]);
  });

  it("ranks doubles players by conservative OpenSkill ordinal, strongest first", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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
    const result = await getDoublesRatings();
    const strongIds = result.slice(0, 2).map((r) => r.playerId).sort();
    expect(strongIds).toEqual(["s1", "s2"]);
  });
});

describe("getPlayerRatingHistory", () => {
  it("scopes to one player/format, oldest first, and serializes asOfDate", async () => {
    prismaMock.ratingSnapshot.findMany.mockResolvedValueOnce([
      { tournamentId: "t1", asOfDate: new Date("2026-01-01T00:00:00.000Z"), rating: 1500, spread: 100 },
    ]);
    const result = await getPlayerRatingHistory("p1", "SINGLES");
    expect(prismaMock.ratingSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: "p1", matchType: "SINGLES" }, orderBy: { asOfDate: "asc" } }),
    );
    expect(result).toEqual([
      { tournamentId: "t1", asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500, spread: 100 },
    ]);
  });
});

describe("getSetClubSeasons", () => {
  it("returns distinct calendar years with a completed match, newest first", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      singlesMatch("m1", "A", "2026-01-01"),
      { ...singlesMatch("m2", "A", "2026-01-01"), tournament: { startDate: new Date("2024-06-01"), participants: [] } },
      { ...singlesMatch("m3", "A", "2026-01-01"), tournament: { startDate: new Date("2025-06-01"), participants: [] } },
    ]);
    const result = await getSetClubSeasons("SINGLES");
    expect(result).toEqual([2026, 2025, 2024]);
  });
});

describe("getDoublesSetClubPoints / getSinglesSetClubPoints", () => {
  it("only includes matches from the requested season", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m2025", "A", "2025-06-01"), tournament: { startDate: new Date("2025-06-01"), participants: [] } },
      { ...singlesMatch("m2026", "A", "2026-06-01"), tournament: { startDate: new Date("2026-06-01"), participants: [] } },
    ]);
    computeDoublesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getDoublesSetClubPoints(2026);

    const seasonRows = computeDoublesSetClubPointsMock.mock.calls[0][0];
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0].id).toBe("m2026");
  });

  it("sorts by points desc, then tournaments played desc, then playerId as a stable tiebreak", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([singlesMatch("m1", "A", "2026-01-01")]);
    computeSinglesSetClubPointsMock.mockReturnValueOnce(
      new Map([
        ["zed", { playerId: "zed", points: 10, tournamentsPlayed: 1 }],
        ["amy", { playerId: "amy", points: 20, tournamentsPlayed: 2 }],
        ["bob", { playerId: "bob", points: 20, tournamentsPlayed: 3 }],
      ]),
    );

    const result = await getSinglesSetClubPoints(2026);

    expect(result.map((r) => r.playerId)).toEqual(["bob", "amy", "zed"]);
  });
});

describe("getDoublesSetClubPoints / getSinglesSetClubPoints (ROLLING_SEASON)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes a tournament well within the last 52 weeks and excludes one well outside it", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m-recent", "A", "2026-01-01"), tournament: { startDate: new Date("2026-01-01"), participants: [] } },
      { ...singlesMatch("m-old", "A", "2024-06-01"), tournament: { startDate: new Date("2024-06-01"), participants: [] } },
    ]);
    computeDoublesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getDoublesSetClubPoints(ROLLING_SEASON);

    const rollingRows = computeDoublesSetClubPointsMock.mock.calls[0][0];
    expect(rollingRows.map((r: { id: string }) => r.id)).toEqual(["m-recent"]);
  });

  it("does not filter by calendar year - a tournament from last December still counts if within 52 weeks", async () => {
    // "now" is fixed to 2026-06-15 above - 2025-12-01 is ~6.5 months earlier, well inside 52 weeks,
    // even though it's a different calendar year than "now".
    prismaMock.match.findMany.mockResolvedValueOnce([
      { ...singlesMatch("m-dec", "A", "2025-12-01"), tournament: { startDate: new Date("2025-12-01"), participants: [] } },
    ]);
    computeSinglesSetClubPointsMock.mockReturnValueOnce(new Map());

    await getSinglesSetClubPoints(ROLLING_SEASON);

    const rollingRows = computeSinglesSetClubPointsMock.mock.calls[0][0];
    expect(rollingRows.map((r: { id: string }) => r.id)).toEqual(["m-dec"]);
  });
});

describe("getSinglesRatingsTrend / getDoublesRatingsTrend", () => {
  it("queries singles matches and omits a debutant from the latest tournament, keeping earlier players", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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

    const deltas = await getSinglesRatingsTrend();

    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ matchType: "SINGLES" }) }),
    );
    // A debut in the very tournament being compared against has no "before" rank at all.
    expect(deltas.has("newbie")).toBe(false);
    expect(deltas.has("vet1")).toBe(true);
    expect(deltas.has("vet2")).toBe(true);
  });

  it("queries doubles matches and omits debutants from the latest tournament", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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

    const deltas = await getDoublesRatingsTrend();

    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ matchType: "DOUBLES" }) }),
    );
    expect(deltas.has("newbie1")).toBe(false);
    expect(deltas.has("newbie2")).toBe(false);
    expect(deltas.has("v1")).toBe(true);
    expect(deltas.has("v3")).toBe(true);
  });
});

describe("getSinglesSetClubTrend / getDoublesSetClubTrend", () => {
  it("diffs the season's current order against the order with its own latest tournament excluded", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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
      // "current" call - both tournaments
      .mockReturnValueOnce(
        new Map([
          ["bob", { playerId: "bob", points: 20, tournamentsPlayed: 2 }],
          ["amy", { playerId: "amy", points: 10, tournamentsPlayed: 2 }],
        ]),
      )
      // "previous" call - latest tournament excluded
      .mockReturnValueOnce(
        new Map([
          ["amy", { playerId: "amy", points: 10, tournamentsPlayed: 1 }],
          ["bob", { playerId: "bob", points: 5, tournamentsPlayed: 1 }],
        ]),
      );

    const deltas = await getSinglesSetClubTrend(2026);

    expect(computeSinglesSetClubPointsMock.mock.calls[0][0].map((r: { id: string }) => r.id)).toEqual([
      "m-old",
      "m-new",
    ]);
    expect(computeSinglesSetClubPointsMock.mock.calls[1][0].map((r: { id: string }) => r.id)).toEqual(["m-old"]);
    // amy led before (1st), bob leads now (1st) - amy dropped one place, bob climbed one.
    expect(deltas.get("bob")).toBe(1);
    expect(deltas.get("amy")).toBe(-1);
  });

  it("excludes the latest tournament within the requested season only, not the club's all-time latest", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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
      // The club's all-time latest tournament, but outside the requested season.
      tournamentMatch({
        id: "m-2026",
        tournamentId: "t-2026",
        startDate: "2026-01-01",
        winnerSide: "A",
        players: [{ side: "A", playerId: "amy" }, { side: "B", playerId: "bob" }],
      }),
    ]);
    computeSinglesSetClubPointsMock.mockReturnValue(new Map());

    await getSinglesSetClubTrend(2023);

    const calls = computeSinglesSetClubPointsMock.mock.calls;
    // "current": season-filtered to 2023 only, the 2026 match never enters the picture.
    expect(calls[0][0].map((r: { id: string }) => r.id)).toEqual(["m-2023-a", "m-2023-b"]);
    // "previous": the latest *within 2023* (m-2023-b) is excluded, not the club's all-time latest.
    expect(calls[1][0].map((r: { id: string }) => r.id)).toEqual(["m-2023-a"]);
  });

  it("computes doubles Set Club deltas the same way", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
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

    const deltas = await getDoublesSetClubTrend(2026);

    // The single tournament this season is also its own latest, so the
    // "previous" order is empty - everyone in "current" is a debut, no deltas.
    expect(deltas.size).toBe(0);
  });
});
