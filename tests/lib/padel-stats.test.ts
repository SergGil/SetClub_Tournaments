import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelMatchPlayer: { findMany: vi.fn() },
    padelMatch: { findMany: vi.fn() },
    padelTournament: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import {
  getAllPadelPlayerStats,
  getPadelHeadToHeadMatchRows,
  getPadelMonthlyActivity,
  getPadelPlayerStats,
  getPadelResultYears,
  getPadelTournamentStandings,
} from "@/lib/padel-stats";

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

describe("getPadelPlayerStats", () => {
  it("scopes the query to the given player and only completed, decided matches", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([]);
    await getPadelPlayerStats("p1");
    expect(prismaMock.padelMatchPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: "p1", match: { status: "COMPLETED", winnerSide: { not: null } } },
      }),
    );
  });

  it("summarizes the returned rows into win/loss stats", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([matchRow({ side: "A", winnerSide: "A" })]);
    const stats = await getPadelPlayerStats("p1");
    expect(stats).toMatchObject({ playerId: "p1", matchesPlayed: 1, wins: 1, losses: 0 });
  });
});

describe("getAllPadelPlayerStats", () => {
  it("groups rows by playerId", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A" }),
      matchRow({ playerId: "p2", side: "B", winnerSide: "A" }),
    ]);
    const stats = await getAllPadelPlayerStats();
    expect([...stats.keys()].sort()).toEqual(["p1", "p2"]);
    expect(stats.get("p1")).toMatchObject({ wins: 1, losses: 0 });
    expect(stats.get("p2")).toMatchObject({ wins: 0, losses: 1 });
  });

  it("accumulates multiple rows for the same player under one entry", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A" }),
      matchRow({ playerId: "p1", side: "B", winnerSide: "A" }),
    ]);
    const stats = await getAllPadelPlayerStats();
    expect(stats.get("p1")).toMatchObject({ matchesPlayed: 2, wins: 1, losses: 1 });
  });

  it("passes matchType through and filters by scheduledDate/createdAt year range when a year is given", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([]);
    await getAllPadelPlayerStats("SINGLES", 2026);
    expect(prismaMock.padelMatchPlayer.findMany).toHaveBeenCalledWith(
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
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([]);
    await getAllPadelPlayerStats();
    const { where } = prismaMock.padelMatchPlayer.findMany.mock.calls[0][0];
    expect(where.match.OR).toBeUndefined();
  });
});

describe("getPadelResultYears", () => {
  it("returns distinct years, newest first, preferring scheduledDate over createdAt", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { scheduledDate: new Date("2024-05-01"), createdAt: new Date("2026-01-01") },
      { scheduledDate: null, createdAt: new Date("2025-06-01") },
      { scheduledDate: new Date("2024-11-01"), createdAt: new Date("2026-01-01") },
    ]);
    expect(await getPadelResultYears()).toEqual([2025, 2024]);
  });

  it("returns an empty array when there are no completed matches", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([]);
    expect(await getPadelResultYears()).toEqual([]);
  });
});

describe("getPadelHeadToHeadMatchRows", () => {
  it("returns the raw per-match player rows", async () => {
    const rows = [{ winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] }];
    prismaMock.padelMatch.findMany.mockResolvedValueOnce(rows);
    expect(await getPadelHeadToHeadMatchRows()).toEqual(rows);
  });
});

describe("getPadelMonthlyActivity", () => {
  it("buckets match and tournament dates by month, preferring scheduledDate", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { completedAt: null, scheduledDate: new Date("2026-01-15"), createdAt: new Date("2026-03-15") },
    ]);
    prismaMock.padelTournament.findMany.mockResolvedValueOnce([{ startDate: new Date("2026-01-01") }]);
    const activity = await getPadelMonthlyActivity();
    expect(activity.matches.find((m) => m.key === "2026-01")?.count).toBe(1);
    expect(activity.tournaments.find((t) => t.key === "2026-01")?.count).toBe(1);
  });

  it("falls back to completedAt, then createdAt, when scheduledDate is missing", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      { completedAt: new Date("2026-02-10"), scheduledDate: null, createdAt: new Date("2026-04-10") },
      { completedAt: null, scheduledDate: null, createdAt: new Date("2026-03-10") },
    ]);
    prismaMock.padelTournament.findMany.mockResolvedValueOnce([]);
    const activity = await getPadelMonthlyActivity();
    expect(activity.matches.find((m) => m.key === "2026-02")?.count).toBe(1);
    expect(activity.matches.find((m) => m.key === "2026-03")?.count).toBe(1);
  });
});

describe("getPadelTournamentStandings", () => {
  it("scopes to the given tournament and groups by player", async () => {
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      matchRow({ playerId: "p1", side: "A", winnerSide: "A", tournamentId: "t1" }),
    ]);
    const standings = await getPadelTournamentStandings("t1");
    expect(prismaMock.padelMatchPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { match: { tournamentId: "t1", status: "COMPLETED", winnerSide: { not: null } } },
      }),
    );
    expect(standings.get("p1")).toMatchObject({ wins: 1 });
  });
});
