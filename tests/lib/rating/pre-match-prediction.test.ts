import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchRowsMock, fetchPadelRowsMock, prismaMock } = vi.hoisted(() => ({
  fetchRowsMock: vi.fn(),
  fetchPadelRowsMock: vi.fn(),
  prismaMock: {
    player: { findMany: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));
vi.mock("@/lib/rating/ratings-data", () => ({ fetchRatingMatchRows: fetchRowsMock }));
vi.mock("@/lib/rating/padel-ratings-data", () => ({ fetchPadelRatingMatchRows: fetchPadelRowsMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { computeDoublesRatings, computeSinglesRatings } from "@/lib/rating/engine";
import type { RatingMatchRow } from "@/lib/rating/engine";
import { matchWinProbability } from "@/lib/rating/match-preview";
import { computePreMatchWinProbA, freezePreMatchWinProbA } from "@/lib/rating/pre-match-prediction";

function row(id: string, sideA: string[], sideB: string[], winnerSide: "A" | "B" = "A"): RatingMatchRow {
  return {
    id,
    tournamentId: "t1",
    tournamentStartDate: 100,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    winnerSide,
    round: null,
    tournamentParticipantCount: 4,
    players: [
      ...sideA.map((playerId) => ({ side: "A" as const, playerId, seeded: false })),
      ...sideB.map((playerId) => ({ side: "B" as const, playerId, seeded: false })),
    ],
    sets: [winnerSide === "A" ? { sideAGames: 6, sideBGames: 2 } : { sideAGames: 2, sideBGames: 6 }],
  };
}

const history = [row("m1", ["p1"], ["p2"]), row("m2", ["p1"], ["p2"])];
// The match being saved - already in the rows once its score is written, and won by the underdog.
const justSaved = row("m3", ["p1"], ["p2"], "B");
const singlesMatch = {
  id: "m3",
  matchType: "SINGLES" as const,
  players: [
    { side: "A" as const, playerId: "p1" },
    { side: "B" as const, playerId: "p2" },
  ],
  tournament: { isWomensOnly: false },
};

function singlesProbA(rows: RatingMatchRow[]) {
  const ratings = new Map([...computeSinglesRatings(rows).values()].map((r) => [r.playerId, r.rating]));
  return matchWinProbability(singlesMatch, ratings, new Map())!.probA;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.player.findMany.mockResolvedValue([]);
  prismaMock.$executeRaw.mockResolvedValue(1);
});

describe("computePreMatchWinProbA", () => {
  it("replays the pool's rows WITHOUT the match itself - the preview's number from before the save", async () => {
    fetchRowsMock.mockResolvedValue([...history, justSaved]);

    const probA = await computePreMatchWinProbA("TENNIS", singlesMatch);

    expect(fetchRowsMock).toHaveBeenCalledWith("SINGLES", "general");
    expect(fetchPadelRowsMock).not.toHaveBeenCalled();
    expect(probA).toBeCloseTo(singlesProbA(history), 12);
    // Including the just-saved upset would have moved it.
    expect(probA).not.toBeCloseTo(singlesProbA([...history, justSaved]), 6);
  });

  it("gives the same answer from rows that don't contain the match yet (a pre-write cache)", async () => {
    fetchRowsMock.mockResolvedValue(history);
    expect(await computePreMatchWinProbA("TENNIS", singlesMatch)).toBeCloseTo(singlesProbA(history), 12);
  });

  it("reads the padel women's pool for a padel women's doubles match, hiding non-women like the live ratings", async () => {
    const doublesHistory = [row("d1", ["a1", "a2"], ["b1", "b2"]), row("d2", ["a1", "a2"], ["b1", "b2"])];
    fetchPadelRowsMock.mockResolvedValue(doublesHistory);
    const doublesMatch = {
      id: "d3",
      matchType: "DOUBLES" as const,
      players: [
        { side: "A" as const, playerId: "a1" },
        { side: "A" as const, playerId: "a2" },
        { side: "B" as const, playerId: "b1" },
        { side: "B" as const, playerId: "b2" },
      ],
      tournament: { isWomensOnly: true },
    };

    prismaMock.player.findMany.mockResolvedValue(["a1", "a2", "b1", "b2"].map((id) => ({ id })));
    const probA = await computePreMatchWinProbA("PADEL", doublesMatch);
    expect(fetchPadelRowsMock).toHaveBeenCalledWith("DOUBLES", "women");
    expect(fetchRowsMock).not.toHaveBeenCalled();
    const ratings = new Map([...computeDoublesRatings(doublesHistory).values()].map((r) => [r.playerId, r.rating]));
    expect(probA).toBeCloseTo(matchWinProbability(doublesMatch, new Map(), ratings)!.probA, 12);
  });

  it("is null when a player has no rating yet - the preview's 'Прогноз недоступний' case", async () => {
    fetchRowsMock.mockResolvedValue([row("m1", ["p1"], ["p9"])]);
    expect(await computePreMatchWinProbA("TENNIS", singlesMatch)).toBeNull();
  });
});

describe("freezePreMatchWinProbA", () => {
  const completedAt = new Date("2026-11-13T10:00:00.123Z");

  it("writes with raw SQL (no @updatedAt bump), guarded to this very completion and an empty column", async () => {
    fetchRowsMock.mockResolvedValue([...history, justSaved]);

    await freezePreMatchWinProbA("TENNIS", { ...singlesMatch, completedAt });

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = prismaMock.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("$");
    expect(sql).toContain('UPDATE "matches" SET "preMatchWinProbA" = $');
    expect(sql).toContain('"status" = \'COMPLETED\'');
    expect(sql).toContain('"completedAt" = $');
    expect(sql).toContain('"preMatchWinProbA" IS NULL');
    expect(sql).not.toContain("updatedAt");
    expect(values[0]).toBeCloseTo(singlesProbA(history), 12);
    expect(values.slice(1)).toEqual(["m3", completedAt]);
  });

  it("targets padel_matches for padel", async () => {
    fetchPadelRowsMock.mockResolvedValue(history);
    await freezePreMatchWinProbA("PADEL", { ...singlesMatch, completedAt });
    const [strings] = prismaMock.$executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join("$")).toContain('UPDATE "padel_matches"');
  });

  it("writes nothing when there's no prediction", async () => {
    fetchRowsMock.mockResolvedValue([]);
    await freezePreMatchWinProbA("TENNIS", { ...singlesMatch, completedAt });
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("never throws - a failure is logged and the match just keeps no prediction", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchRowsMock.mockRejectedValue(new Error("db down"));

    await expect(freezePreMatchWinProbA("TENNIS", { ...singlesMatch, completedAt })).resolves.toBeUndefined();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
