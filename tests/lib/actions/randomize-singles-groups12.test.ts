import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { txMock } = vi.hoisted(() => ({
  txMock: {
    match: { deleteMany: vi.fn(), createMany: vi.fn() },
    matchPlayer: { createMany: vi.fn() },
    matchAdvancement: { createMany: vi.fn() },
    tournamentParticipant: { update: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { findUnique: vi.fn() },
    tournamentParticipant: { findMany: vi.fn() },
    match: { count: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(txMock);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

const { scheduleRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  scheduleRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/snapshot", () => ({
  scheduleRatingSnapshotRefresh: scheduleRatingSnapshotRefreshMock,
}));

import { commitGroups12PlayoffAction, drawGroups12PlayoffAction } from "@/lib/actions/randomize-singles-groups12";

function makeRoster(seededCount: number, unseededCount: number) {
  const seeded = Array.from({ length: seededCount }, (_, i) => ({
    playerId: `seeded-${i}`,
    seed: i + 1,
    player: { name: `Seeded ${i}` },
  }));
  const unseeded = Array.from({ length: unseededCount }, (_, i) => ({
    playerId: `unseeded-${i}`,
    seed: null,
    player: { name: `Unseeded ${i}` },
  }));
  return [...seeded, ...unseeded];
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
});

describe("drawGroups12PlayoffAction", () => {
  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await drawGroups12PlayoffAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when there aren't exactly 12 participants", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 7));
    const result = await drawGroups12PlayoffAction("t1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("12");
  });

  it("errors when there aren't exactly 4 seeded participants", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(3, 9));
    const result = await drawGroups12PlayoffAction("t1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("4 сіяних");
  });

  it("draws 4 empty A-D baskets, all 12 players, and 12 matchups", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 8));

    const result = await drawGroups12PlayoffAction("t1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.existingGroups).toEqual([
      { group: 1, players: [] },
      { group: 2, players: [] },
      { group: 3, players: [] },
      { group: 4, players: [] },
    ]);
    expect(result.revealOrder).toHaveLength(12);
    expect(Object.keys(result.groupAssignment)).toHaveLength(12);
    expect(result.matchups).toHaveLength(12);
    for (const m of result.matchups) {
      expect(m.round).toMatch(/^Група [A-D]$/);
    }
  });
});

describe("commitGroups12PlayoffAction", () => {
  const groupAssignment = {
    "seeded-0": 1,
    "seeded-1": 2,
    "seeded-2": 3,
    "seeded-3": 4,
    "unseeded-0": 1,
    "unseeded-1": 1,
    "unseeded-2": 2,
    "unseeded-3": 2,
    "unseeded-4": 3,
    "unseeded-5": 3,
    "unseeded-6": 4,
    "unseeded-7": 4,
  };
  const matchups = [
    { sideA: "seeded-0", sideB: "unseeded-0", round: "Група A" },
    { sideA: "seeded-0", sideB: "unseeded-1", round: "Група A" },
    { sideA: "unseeded-0", sideB: "unseeded-1", round: "Група A" },
    { sideA: "seeded-1", sideB: "unseeded-2", round: "Група B" },
    { sideA: "seeded-1", sideB: "unseeded-3", round: "Група B" },
    { sideA: "unseeded-2", sideB: "unseeded-3", round: "Група B" },
    { sideA: "seeded-2", sideB: "unseeded-4", round: "Група C" },
    { sideA: "seeded-2", sideB: "unseeded-5", round: "Група C" },
    { sideA: "unseeded-4", sideB: "unseeded-5", round: "Група C" },
    { sideA: "seeded-3", sideB: "unseeded-6", round: "Група D" },
    { sideA: "seeded-3", sideB: "unseeded-7", round: "Група D" },
    { sideA: "unseeded-6", sideB: "unseeded-7", round: "Група D" },
  ];

  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await commitGroups12PlayoffAction("t1", groupAssignment, matchups, false);
    expect(result.error).toBeDefined();
  });

  it("errors when the roster isn't exactly 12 participants with exactly 4 seeded", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 7));
    const result = await commitGroups12PlayoffAction("t1", groupAssignment, matchups, false);
    expect(result.error).toContain("12");
  });

  it("rejects a group assignment outside 1-4", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 8));
    const result = await commitGroups12PlayoffAction(
      "t1",
      { ...groupAssignment, "seeded-0": 5 },
      matchups,
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("rejects a matchup referencing a player outside the roster", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 8));
    const badMatchups = [...matchups.slice(1), { sideA: "seeded-0", sideB: "ghost", round: "Група A" }];
    const result = await commitGroups12PlayoffAction("t1", groupAssignment, badMatchups, false);
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("persists group assignments, 12 group matches, 18 bracket placeholders, and 36 advancement rows", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(makeRoster(4, 8));

    const result = await commitGroups12PlayoffAction("t1", groupAssignment, matchups, false);

    expect(result).toEqual({ success: true, matchCount: 30 });
    expect(txMock.match.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(txMock.tournamentParticipant.update).toHaveBeenCalledTimes(12);

    // First match.createMany call: the 12 real group-stage matches.
    const matchCreateCalls = txMock.match.createMany.mock.calls;
    expect(matchCreateCalls).toHaveLength(2);
    expect(matchCreateCalls[0][0].data).toHaveLength(12);
    expect(matchCreateCalls[1][0].data).toHaveLength(18);
    expect(matchCreateCalls[1][0].data.every((m: { round: string }) => typeof m.round === "string")).toBe(true);

    expect(txMock.matchPlayer.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.matchPlayer.createMany.mock.calls[0][0].data).toHaveLength(24); // 12 matches x 2 players

    expect(txMock.matchAdvancement.createMany).toHaveBeenCalledTimes(1);
    const advancementRows = txMock.matchAdvancement.createMany.mock.calls[0][0].data;
    expect(advancementRows).toHaveLength(36); // 18 bracket matches x 2 sides
    expect(advancementRows.every((r: { tournamentId: string }) => r.tournamentId === "t1")).toBe(true);
    const groupRankRows = advancementRows.filter((r: { source: string }) => r.source === "GROUP_RANK");
    const matchResultRows = advancementRows.filter((r: { source: string }) => r.source === "MATCH_RESULT");
    // QF (4 matches x 2 sides) + mini-group (6 matches x 2 sides) = 20 GROUP_RANK rows.
    expect(groupRankRows).toHaveLength(20);
    expect(matchResultRows).toHaveLength(16);
    // Every MATCH_RESULT row's sourceMatchId must resolve to one of the created bracket match ids.
    const bracketMatchIds = new Set(matchCreateCalls[1][0].data.map((m: { id: string }) => m.id));
    for (const row of matchResultRows) {
      expect(bracketMatchIds.has(row.sourceMatchId)).toBe(true);
    }
  });
});
