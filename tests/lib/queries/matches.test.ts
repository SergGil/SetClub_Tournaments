import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { match: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getAllMatches,
  getMatchesPage,
  getPlayerMatches,
  getRecentCompletedMatches,
  getTournamentMatches,
} from "@/lib/queries/matches";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.match.findMany.mockResolvedValue([]);
  prismaMock.match.count.mockResolvedValue(0);
});

describe("getPlayerMatches / getTournamentMatches / getRecentCompletedMatches / getAllMatches", () => {
  it("scopes to the given player", async () => {
    await getPlayerMatches("p1");
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("scopes to the given tournament", async () => {
    await getTournamentMatches("t1");
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
  });

  it("only fetches decided, completed matches for the recent-results feed", async () => {
    await getRecentCompletedMatches(5);
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COMPLETED", winnerSide: { not: null } },
        take: 5,
      }),
    );
  });

  it("fetches every match unfiltered", async () => {
    await getAllMatches();
    const [args] = prismaMock.match.findMany.mock.calls[0];
    expect(args.where).toBeUndefined();
  });
});

describe("getMatchesPage", () => {
  it("builds an empty where clause with no filters", async () => {
    await getMatchesPage(20, {});
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 20 }));
    expect(prismaMock.match.count).toHaveBeenCalledWith({ where: {} });
  });

  it("filters by player", async () => {
    await getMatchesPage(20, { playerId: "p1" });
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("filters by status", async () => {
    await getMatchesPage(20, { status: "COMPLETED" });
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "COMPLETED" } }),
    );
  });

  it("filters by a calendar day using a UTC range, falling back to createdAt for unscheduled matches", async () => {
    await getMatchesPage(20, { date: "2026-03-15" });
    expect(prismaMock.match.findMany).toHaveBeenCalledWith(
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
    await getMatchesPage(10, { playerId: "p1", date: "2026-03-15", status: "SCHEDULED" });
    const where = prismaMock.match.findMany.mock.calls[0][0].where;
    expect(where.players).toEqual({ some: { playerId: "p1" } });
    expect(where.status).toBe("SCHEDULED");
    expect(where.OR).toHaveLength(2);
  });

  it("returns both the page and the total count", async () => {
    prismaMock.match.findMany.mockResolvedValueOnce([{ id: "m1" }]);
    prismaMock.match.count.mockResolvedValueOnce(42);
    const result = await getMatchesPage(1, {});
    expect(result).toEqual({ matches: [{ id: "m1" }], total: 42 });
  });
});
