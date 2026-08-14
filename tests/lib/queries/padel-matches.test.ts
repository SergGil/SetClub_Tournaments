import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { padelMatch: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getAllPadelMatches,
  getPadelMatchesPage,
  getPadelSeasonMatchCount,
  getPadelTournamentMatches,
  getPlayerPadelMatches,
  getRecentCompletedPadelMatches,
} from "@/lib/queries/padel-matches";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelMatch.findMany.mockResolvedValue([]);
  prismaMock.padelMatch.count.mockResolvedValue(0);
});

describe("getPlayerPadelMatches / getPadelTournamentMatches / getRecentCompletedPadelMatches / getAllPadelMatches", () => {
  it("scopes to the given player", async () => {
    await getPlayerPadelMatches("p1");
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("scopes to the given tournament", async () => {
    await getPadelTournamentMatches("t1");
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
  });

  it("only fetches decided, completed matches for the recent-results feed", async () => {
    await getRecentCompletedPadelMatches(5);
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COMPLETED", winnerSide: { not: null } },
        take: 5,
      }),
    );
  });

  it("fetches every match unfiltered", async () => {
    await getAllPadelMatches();
    const [args] = prismaMock.padelMatch.findMany.mock.calls[0];
    expect(args.where).toBeUndefined();
  });
});

describe("getPadelSeasonMatchCount", () => {
  it("counts decided, non-walkover Padel matches whose tournament started in the given calendar year (UTC)", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(11);
    const result = await getPadelSeasonMatchCount(2026);
    expect(prismaMock.padelMatch.count).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        walkover: false,
        tournament: {
          startDate: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") },
        },
      },
    });
    expect(result).toBe(11);
  });
});

describe("getPadelMatchesPage", () => {
  it("builds an empty where clause with no filters", async () => {
    await getPadelMatchesPage(20, {});
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 20 }));
    expect(prismaMock.padelMatch.count).toHaveBeenCalledWith({ where: {} });
  });

  it("filters by player", async () => {
    await getPadelMatchesPage(20, { playerId: "p1" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("filters by status", async () => {
    await getPadelMatchesPage(20, { status: "COMPLETED" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "COMPLETED" } }),
    );
  });

  it("filters by a calendar day using a UTC range, falling back to createdAt for unscheduled matches", async () => {
    await getPadelMatchesPage(20, { date: "2026-03-15" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              scheduledDate: {
                gte: new Date("2026-03-15T00:00:00.000Z"),
                lt: new Date("2026-03-16T00:00:00.000Z"),
              },
            },
            {
              scheduledDate: null,
              createdAt: {
                gte: new Date("2026-03-15T00:00:00.000Z"),
                lt: new Date("2026-03-16T00:00:00.000Z"),
              },
            },
          ],
        },
      }),
    );
  });

  it("combines every filter together", async () => {
    await getPadelMatchesPage(10, { playerId: "p1", date: "2026-03-15", status: "SCHEDULED" });
    const where = prismaMock.padelMatch.findMany.mock.calls[0][0].where;
    expect(where.players).toEqual({ some: { playerId: "p1" } });
    expect(where.status).toBe("SCHEDULED");
    expect(where.OR).toHaveLength(2);
  });

  it("returns both the page and the total count", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([{ id: "m1" }]);
    prismaMock.padelMatch.count.mockResolvedValueOnce(42);
    const result = await getPadelMatchesPage(1, {});
    expect(result).toEqual({ matches: [{ id: "m1" }], total: 42 });
  });
});
