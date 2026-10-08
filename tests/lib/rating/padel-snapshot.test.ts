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
vi.mock("@/lib/rating/ratings-data", () => ({
  // Real value, not a mock - padel-snapshot.ts derives its scope/pool list from this.
  SNAPSHOT_POOL: { general: "GENERAL", women: "WOMEN" },
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
  it("wipes and rebuilds PadelRatingSnapshot from freshly computed singles/doubles snapshots, for both the general and women's pools", async () => {
    const generalSinglesRows = ["general-singles-row"];
    const generalDoublesRows = ["general-doubles-row"];
    const womenSinglesRows = ["women-singles-row"];
    const womenDoublesRows = ["women-doubles-row"];
    fetchPadelRatingMatchRowsMock.mockImplementation(async (matchType: string, scope: string) => {
      if (matchType === "SINGLES" && scope === "general") return generalSinglesRows;
      if (matchType === "DOUBLES" && scope === "general") return generalDoublesRows;
      if (matchType === "SINGLES" && scope === "women") return womenSinglesRows;
      if (matchType === "DOUBLES" && scope === "women") return womenDoublesRows;
      throw new Error(`unexpected fetchPadelRatingMatchRows(${matchType}, ${scope})`);
    });

    const singlesRating = { rating: 1600, rd: 100, volatility: 0.06 };
    const singlesRatingWomen = { rating: 1550, rd: 120, volatility: 0.06 };
    const doublesRating = { mu: 30, sigma: 5 };
    const doublesRatingWomen = { mu: 28, sigma: 6 };
    computeSinglesRatingsWithHistoryMock.mockImplementation((rows: unknown[]) => {
      if (rows === generalSinglesRows) {
        return {
          final: new Map(),
          snapshots: [{ playerId: "p1", tournamentId: "t1", asOfDate: "2026-01-01", rating: singlesRating }],
        };
      }
      if (rows === womenSinglesRows) {
        return {
          final: new Map(),
          snapshots: [{ playerId: "p3", tournamentId: "t3", asOfDate: "2026-03-01", rating: singlesRatingWomen }],
        };
      }
      throw new Error("unexpected singles rows");
    });
    computeDoublesRatingsWithHistoryMock.mockImplementation((rows: unknown[]) => {
      if (rows === generalDoublesRows) {
        return {
          final: new Map(),
          snapshots: [{ playerId: "p2", tournamentId: "t2", asOfDate: "2026-02-01", rating: doublesRating }],
        };
      }
      if (rows === womenDoublesRows) {
        return {
          final: new Map(),
          snapshots: [{ playerId: "p4", tournamentId: "t4", asOfDate: "2026-04-01", rating: doublesRatingWomen }],
        };
      }
      throw new Error("unexpected doubles rows");
    });

    await refreshPadelRatingSnapshots();

    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("SINGLES", "general");
    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("DOUBLES", "general");
    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("SINGLES", "women");
    expect(fetchPadelRatingMatchRowsMock).toHaveBeenCalledWith("DOUBLES", "women");
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.padelRatingSnapshot.deleteMany).toHaveBeenCalledWith({});

    const rows = prismaMock.padelRatingSnapshot.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(4);
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          playerId: "p1",
          matchType: "SINGLES",
          pool: "GENERAL",
          tournamentId: "t1",
          asOfDate: new Date("2026-01-01"),
          rating: Math.round(conservativeRating(singlesRating)),
          spread: Math.round(singlesRating.rd),
        },
        {
          playerId: "p2",
          matchType: "DOUBLES",
          pool: "GENERAL",
          tournamentId: "t2",
          asOfDate: new Date("2026-02-01"),
          rating: Math.round(conservativeOrdinal(doublesRating)),
          spread: Math.round(displaySpread(doublesRating.sigma)),
        },
        {
          playerId: "p3",
          matchType: "SINGLES",
          pool: "WOMEN",
          tournamentId: "t3",
          asOfDate: new Date("2026-03-01"),
          rating: Math.round(conservativeRating(singlesRatingWomen)),
          spread: Math.round(singlesRatingWomen.rd),
        },
        {
          playerId: "p4",
          matchType: "DOUBLES",
          pool: "WOMEN",
          tournamentId: "t4",
          asOfDate: new Date("2026-04-01"),
          rating: Math.round(conservativeOrdinal(doublesRatingWomen)),
          spread: Math.round(displaySpread(doublesRatingWomen.sigma)),
        },
      ]),
    );
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
