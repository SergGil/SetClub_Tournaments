import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelRatingSnapshot: { deleteMany: vi.fn(), createMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { computeSinglesRatingsWithHistoryMock, computeDoublesRatingsWithHistoryMock } = vi.hoisted(() => ({
  computeSinglesRatingsWithHistoryMock: vi.fn(),
  computeDoublesRatingsWithHistoryMock: vi.fn(),
}));
vi.mock("@/lib/rating/engine", () => ({
  computeSinglesRatingsWithHistory: computeSinglesRatingsWithHistoryMock,
  computeDoublesRatingsWithHistory: computeDoublesRatingsWithHistoryMock,
}));

const { fetchPadelRatingMatchRowsMock } = vi.hoisted(() => ({ fetchPadelRatingMatchRowsMock: vi.fn() }));
vi.mock("@/lib/rating/padel-ratings-data", () => ({
  fetchPadelRatingMatchRows: fetchPadelRatingMatchRowsMock,
}));

const { afterMock, afterTasks } = vi.hoisted(() => {
  const tasks: unknown[] = [];
  return { afterMock: vi.fn((task: () => unknown) => { tasks.push(task()); }), afterTasks: tasks };
});
vi.mock("next/server", () => ({ after: afterMock }));

import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { refreshPadelRatingSnapshots, schedulePadelRatingSnapshotRefresh } from "@/lib/rating/padel-snapshot";

beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
  fetchPadelRatingMatchRowsMock.mockResolvedValue([]);
});

describe("refreshPadelRatingSnapshots", () => {
  it("wipes and rebuilds PadelRatingSnapshot from freshly computed singles/doubles snapshots", async () => {
    const singlesRating = { rating: 1600, rd: 100, volatility: 0.06 };
    const doublesRating = { mu: 30, sigma: 5 };
    computeSinglesRatingsWithHistoryMock.mockReturnValueOnce({
      final: new Map(),
      snapshots: [{ playerId: "p1", tournamentId: "t1", asOfDate: "2026-01-01", rating: singlesRating }],
    });
    computeDoublesRatingsWithHistoryMock.mockReturnValueOnce({
      final: new Map(),
      snapshots: [{ playerId: "p2", tournamentId: "t2", asOfDate: "2026-02-01", rating: doublesRating }],
    });

    await refreshPadelRatingSnapshots();

    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("SINGLES");
    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("DOUBLES");
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.padelRatingSnapshot.deleteMany).toHaveBeenCalledWith({});

    const rows = prismaMock.padelRatingSnapshot.createMany.mock.calls[0][0].data;
    expect(rows).toEqual([
      {
        playerId: "p1",
        matchType: "SINGLES",
        tournamentId: "t1",
        asOfDate: new Date("2026-01-01"),
        rating: Math.round(conservativeRating(singlesRating)),
        spread: Math.round(singlesRating.rd),
      },
      {
        playerId: "p2",
        matchType: "DOUBLES",
        tournamentId: "t2",
        asOfDate: new Date("2026-02-01"),
        rating: Math.round(conservativeOrdinal(doublesRating)),
        spread: Math.round(displaySpread(doublesRating.sigma)),
      },
    ]);
  });
});

describe("schedulePadelRatingSnapshotRefresh", () => {
  it("defers the rebuild via after()", async () => {
    computeSinglesRatingsWithHistoryMock.mockReturnValue({ final: new Map(), snapshots: [] });
    computeDoublesRatingsWithHistoryMock.mockReturnValue({ final: new Map(), snapshots: [] });

    schedulePadelRatingSnapshotRefresh();
    expect(afterMock).toHaveBeenCalledTimes(1);
    await afterTasks[0];

    expect(prismaMock.padelRatingSnapshot.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a failure instead of letting it escape", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchPadelRatingMatchRowsMock.mockRejectedValueOnce(new Error("db down"));

    schedulePadelRatingSnapshotRefresh();
    await expect(afterTasks[0]).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith("Failed to refresh Padel rating snapshots", expect.any(Error));
    consoleError.mockRestore();
  });
});
