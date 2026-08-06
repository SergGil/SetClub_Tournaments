import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    matchPlayer: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
    tournament: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/cache", () => ({
  // stats.ts wraps every query in this - stub it as a passthrough so the
  // wrapped function is directly callable, same shape it'd have live.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  getAllPlayerStats,
  getHeadToHeadMatchRows,
  getMonthlyActivity,
  getPlayerStats,
  getResultYears,
  getTournamentStandings,
} from "@/lib/stats";

beforeEach(() => {
  vi.clearAllMocks();
});

function matchRow(overrides: {
  playerId?: string;
  side: "A" | "B";
  winnerSide: "A" | "B";
  tournamentId?: string;
  sets?: { sideAGames: number; sideBGames: number }[];
}) {
  return {
    playerId: overrides.playerId,
    side: overrides.side,
    match: {
      winnerSide: overrides.winnerSide,
      tournamentId: overrides.tournamentId ?? "t1",
      sets: overrides.sets ?? [{ sideAGames: 6, sideBGames: 3 }],
    },
  };
}

describe("getPlayerStats", () => {
  it("scopes the query to the given player and only completed, decided matches", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([]);
    await getPlayerStats("p1");
    expect(prismaMock.matchPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: "p1", match: { status: "COMPLETED", winnerSide: { not: null } } },
      }),
    );
  });

  it("summarizes the returned rows into win/loss stats", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([matchRow({ side: "A", winnerSide: "A" })]);
    const stats = await getPlayerStats("p1");
    expect(stats).toMatchObject({ playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0 });
  });
});

describe("getAllPlayerStats", () => {
  it("groups rows by playerId", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A" }),
      matchRow({ playerId: "p2", side: "B", winnerSide: "A" }),
    ]);
    const stats = await getAllPlayerStats();
    expect([...stats.keys()].sort()).toEqual(["p1", "p2"]);
    expect(stats.get("p1")).toMatchObject({ wins: 1, losses: 0 });
    expect(stats.get("p2")).toMatchObject({ wins: 0, losses: 1 });
  });

  it("accumulates multiple rows for the same player under one entry", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A" }),
      matchRow({ playerId: "p1", side: "B", winnerSide: "A" }),
    ]);
    const stats = await getAllPlayerStats();
    expect(stats.get("p1")).toMatchObject({ matchesPlayed: 2, wins: 1, losses: 1 });
  });

  it("passes matchType through and filters by scheduledDate/createdAt year range when a year is given", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([]);
    await getAllPlayerStats("SINGLES", 2026);
    expect(prismaMock.matchPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          match: expect.objectContaining({
            matchType: "SINGLES",
            OR: [
              { scheduledDate: { gte: new Date(Date.UTC(2026, 0, 1)), lt: new Date(Date.UTC(2027, 0, 1)) } },
              {
                scheduledDate: null,
                createdAt: { gte: new Date(Date.UTC(2026, 0, 1)), lt: new Date(Date.UTC(2027, 0, 1)) },
              },
            ],
          }),
        }),
      }),
    );
  });

  it("omits the year range filter when no year is given", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([]);
    await getAllPlayerStats();
    const { where } = prismaMock.matchPlayer.findMany.mock.calls[0][0];
    expect(where.match.OR).toBeUndefined();
  });
});

describe("getResultYears", () => {
  it("returns distinct years, newest first, preferring scheduledDate over createdAt", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { scheduledDate: new Date("2024-05-01"), createdAt: new Date("2026-01-01") },
      { scheduledDate: null, createdAt: new Date("2025-06-01") },
      { scheduledDate: new Date("2024-11-01"), createdAt: new Date("2026-01-01") },
    ]);
    expect(await getResultYears()).toEqual([2025, 2024]);
  });

  it("returns an empty array when there are no completed matches", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([]);
    expect(await getResultYears()).toEqual([]);
  });
});

describe("getHeadToHeadMatchRows", () => {
  it("returns the raw per-match player rows", async () => {
    const rows = [{ winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] }];
    prismaMock.match.findMany.mockResolvedValueOnce(rows);
    expect(await getHeadToHeadMatchRows()).toEqual(rows);
  });
});

describe("getMonthlyActivity", () => {
  it("buckets match and tournament dates by month, preferring scheduledDate", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { completedAt: null, scheduledDate: new Date("2026-01-15"), createdAt: new Date("2026-03-15") },
    ]);
    prismaMock.tournament.findMany.mockResolvedValueOnce([{ startDate: new Date("2026-01-01") }]);
    const activity = await getMonthlyActivity();
    expect(activity.matches.find((m) => m.key === "2026-01")?.count).toBe(1);
    expect(activity.tournaments.find((t) => t.key === "2026-01")?.count).toBe(1);
  });

  it("falls back to completedAt, then createdAt, when scheduledDate is missing", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([
      { completedAt: new Date("2026-02-10"), scheduledDate: null, createdAt: new Date("2026-04-10") },
      { completedAt: null, scheduledDate: null, createdAt: new Date("2026-03-10") },
    ]);
    prismaMock.tournament.findMany.mockResolvedValueOnce([]);
    const activity = await getMonthlyActivity();
    expect(activity.matches.find((m) => m.key === "2026-02")?.count).toBe(1);
    expect(activity.matches.find((m) => m.key === "2026-03")?.count).toBe(1);
  });
});

describe("getTournamentStandings", () => {
  it("scopes to the given tournament and groups by player", async () => {
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A", tournamentId: "t1" }),
    ]);
    const standings = await getTournamentStandings("t1");
    expect(prismaMock.matchPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { match: { tournamentId: "t1", status: "COMPLETED", winnerSide: { not: null } } },
      }),
    );
    expect(standings.get("p1")).toMatchObject({ wins: 1 });
  });
});
