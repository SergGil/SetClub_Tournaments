import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { player: { findMany: vi.fn(async (): Promise<{ id: string }[]> => [{ id: "amy" }, { id: "beth" }]) } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { femaleIdsForScope, filterBySeason, filterEligible, sortSetClubPoints } from "@/lib/rating/rating-pools";
import type { SetClubPointsRow } from "@/lib/rating/placement";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("femaleIdsForScope", () => {
  it("is null for the general pool (no filtering) and the female id set for the women's pool", async () => {
    expect(await femaleIdsForScope("general")).toBeNull();
    expect(prismaMock.player.findMany).not.toHaveBeenCalled();
    expect(await femaleIdsForScope("women")).toEqual(new Set(["amy", "beth"]));
    expect(prismaMock.player.findMany).toHaveBeenCalledWith({ where: { gender: "FEMALE" }, select: { id: true } });
  });
});

describe("filterEligible", () => {
  const rows = [{ playerId: "amy" }, { playerId: "male1" }];
  it("is a no-op with a null set and drops ids outside the set otherwise", () => {
    expect(filterEligible(rows, null)).toEqual(rows);
    expect(filterEligible(rows, new Set(["amy"]))).toEqual([{ playerId: "amy" }]);
  });
});

describe("sortSetClubPoints", () => {
  const row = (playerId: string, points: number, tournamentsPlayed: number) =>
    ({ playerId, points, tournamentsPlayed }) as SetClubPointsRow;
  it("orders by points, then tournaments played, then player id, without mutating the input", () => {
    const input = [row("b", 10, 1), row("a", 10, 1), row("c", 10, 3), row("d", 20, 1)];
    expect(sortSetClubPoints(input).map((r) => r.playerId)).toEqual(["d", "c", "a", "b"]);
    expect(input.map((r) => r.playerId)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("filterBySeason", () => {
  const day = 24 * 60 * 60 * 1000;
  const rows = [
    { id: "recent", tournamentStartDate: Date.now() - 10 * day },
    { id: "old", tournamentStartDate: Date.now() - 400 * day },
    { id: "y2020", tournamentStartDate: new Date("2020-06-01T00:00:00.000Z").getTime() },
  ];
  it("'rolling' keeps only the last 52 weeks; a number keeps that calendar year", () => {
    expect(filterBySeason(rows, "rolling").map((r) => r.id)).toEqual(["recent"]);
    expect(filterBySeason(rows, 2020).map((r) => r.id)).toEqual(["y2020"]);
  });
});
