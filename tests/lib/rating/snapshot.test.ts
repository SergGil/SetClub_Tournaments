import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    ratingSnapshot: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => Promise.all(arg as Promise<unknown>[])),
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

const { fetchRatingMatchRowsMock } = vi.hoisted(() => ({ fetchRatingMatchRowsMock: vi.fn() }));
vi.mock("@/lib/rating/ratings-data", () => ({ fetchRatingMatchRows: fetchRatingMatchRowsMock }));

const { afterMock, afterTasks } = vi.hoisted(() => {
  const tasks: unknown[] = [];
  return { afterMock: vi.fn((task: () => unknown) => { tasks.push(task()); }), afterTasks: tasks };
});
vi.mock("next/server", () => ({ after: afterMock }));

import { conservativeRating } from "@/lib/rating/glicko2";
import { conservativeOrdinal, displaySpread } from "@/lib/rating/openskill";
import { refreshRatingSnapshots, scheduleRatingSnapshotRefresh } from "@/lib/rating/snapshot";

beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
  fetchRatingMatchRowsMock.mockResolvedValue([]);
});

describe("refreshRatingSnapshots", () => {
  it("wipes and rebuilds RatingSnapshot from freshly computed singles/doubles snapshots", async () => {
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

    await refreshRatingSnapshots();

    expect(fetchRatingMatchRowsMock).toHaveBeenCalledWith("SINGLES");
    expect(fetchRatingMatchRowsMock).toHaveBeenCalledWith("DOUBLES");
    expect(prismaMock.ratingSnapshot.deleteMany).toHaveBeenCalledWith({});

    const rows = prismaMock.ratingSnapshot.createMany.mock.calls[0][0].data;
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

describe("scheduleRatingSnapshotRefresh", () => {
  it("defers the rebuild via after()", async () => {
    computeSinglesRatingsWithHistoryMock.mockReturnValue({ final: new Map(), snapshots: [] });
    computeDoublesRatingsWithHistoryMock.mockReturnValue({ final: new Map(), snapshots: [] });

    scheduleRatingSnapshotRefresh();
    expect(afterMock).toHaveBeenCalledTimes(1);
    await afterTasks[0];

    expect(prismaMock.ratingSnapshot.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a failure instead of letting it escape", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchRatingMatchRowsMock.mockRejectedValueOnce(new Error("db down"));

    scheduleRatingSnapshotRefresh();
    await expect(afterTasks[0]).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith("Failed to refresh rating snapshots", expect.any(Error));
    consoleError.mockRestore();
  });
});
