import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { tournament: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getLastDoublesTournamentPairs } from "@/lib/queries/doubles-pair-history";
import { pairKey } from "@/lib/randomize-pairs";

const current = {
  id: "t-now",
  startDate: new Date("2026-11-01"),
  createdAt: new Date("2026-10-20"),
  isWomensOnly: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tournament.findFirst.mockResolvedValue(null);
});

describe("getLastDoublesTournamentPairs", () => {
  it("looks back at the latest played doubles tournament that started before this one", async () => {
    await getLastDoublesTournamentPairs(current);
    expect(prismaMock.tournament.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: "t-now" },
          format: "DOUBLES",
          isWomensOnly: false,
          matches: { some: { status: "COMPLETED" } },
          OR: [
            { startDate: { lt: current.startDate } },
            { startDate: current.startDate, createdAt: { lt: current.createdAt } },
          ],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }),
    );
  });

  it("a women's tournament looks back only at women's tournaments", async () => {
    await getLastDoublesTournamentPairs({ ...current, isWomensOnly: true });
    expect(prismaMock.tournament.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isWomensOnly: true }) }),
    );
  });

  it("returns no pairs when there's no earlier played doubles tournament", async () => {
    expect((await getLastDoublesTournamentPairs(current)).size).toBe(0);
  });

  it("collects each side's two players as one pair, once", async () => {
    prismaMock.tournament.findFirst.mockResolvedValueOnce({
      matches: [
        {
          players: [
            { side: "A", playerId: "p1" },
            { side: "A", playerId: "p2" },
            { side: "B", playerId: "p3" },
            { side: "B", playerId: "p4" },
          ],
        },
        {
          players: [
            { side: "A", playerId: "p4" },
            { side: "A", playerId: "p3" },
            { side: "B", playerId: "p6" },
            { side: "B", playerId: "p5" },
          ],
        },
        // A playoff placeholder that hasn't been filled in yet.
        { players: [] },
      ],
    });
    const pairs = await getLastDoublesTournamentPairs(current);
    expect([...pairs].sort()).toEqual([pairKey("p1", "p2"), pairKey("p3", "p4"), pairKey("p5", "p6")].sort());
  });
});
