import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

const { txMock } = vi.hoisted(() => ({
  txMock: {
    match: { deleteMany: vi.fn(), createMany: vi.fn() },
    matchPlayer: { createMany: vi.fn() },
    tournamentParticipant: { update: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { findUnique: vi.fn() },
    tournamentParticipant: { findMany: vi.fn() },
    // No custom (admin-named) groups by default - individual tests override
    // this when they specifically exercise that path.
    tournamentGroup: { findMany: vi.fn().mockResolvedValue([]) },
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
  // src/lib/stats.ts (pulled in transitively for STATS_CACHE_TAG) wraps its
  // queries in this at module scope - stub it as a passthrough.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

const { scheduleRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  scheduleRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/snapshot", () => ({
  scheduleRatingSnapshotRefresh: scheduleRatingSnapshotRefreshMock,
}));

import {
  commitSinglesGroupsAction,
  commitSinglesRoundRobinAction,
  drawSinglesGroupsAction,
} from "@/lib/actions/randomize-singles";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
});

describe("commitSinglesRoundRobinAction", () => {
  const participants4 = [
    { playerId: "p1", seed: 1 },
    { playerId: "p2", seed: null },
    { playerId: "p3", seed: 1 },
    { playerId: "p4", seed: null },
  ];

  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await commitSinglesRoundRobinAction("t1", "ALL", false);
    expect(result.error).toBeDefined();
  });

  it("errors with fewer than 2 participants", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([{ playerId: "p1", seed: null }]);
    const result = await commitSinglesRoundRobinAction("t1", "ALL", false);
    expect(result.error).toContain("2 учасники");
  });

  it("errors when only 1 seeded participant would get no seeded-pool match", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", seed: 1 },
      { playerId: "p2", seed: null },
      { playerId: "p3", seed: null },
    ]);
    const result = await commitSinglesRoundRobinAction("t1", "SEEDED_SPLIT", false);
    expect(result.error).toContain("сіяних лише 1");
  });

  it("builds a full round robin for ALL and reports the match count", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(participants4);

    const result = await commitSinglesRoundRobinAction("t1", "ALL", false);

    // 4 participants, all-vs-all -> C(4,2) = 6 matches.
    expect(result).toEqual({ success: true, matchCount: 6 });
    expect(txMock.match.createMany).toHaveBeenCalled();
  });

  it("splits seeded/unseeded pools for SEEDED_SPLIT", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(participants4);

    const result = await commitSinglesRoundRobinAction("t1", "SEEDED_SPLIT", false);

    // 2 seeded + 2 unseeded -> 1 match per pool = 2 matches total.
    expect(result).toEqual({ success: true, matchCount: 2 });
  });
});

describe("drawSinglesGroupsAction", () => {
  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await drawSinglesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when no participant has a group assigned yet", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, player: { name: "Іван" } },
      { playerId: "p2", group: null, player: { name: "Петро" } },
    ]);
    const result = await drawSinglesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("assigns ungrouped players and builds per-group matchups", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: 1, player: { name: "Іван" } },
      { playerId: "p2", group: 1, player: { name: "Петро" } },
      { playerId: "p3", group: null, player: { name: "Олег" } },
    ]);

    const result = await drawSinglesGroupsAction("t1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.existingGroups).toEqual([{ group: 1, players: expect.any(Array) }]);
    expect(result.groupAssignment.p3).toBe(1);
  });
});

describe("commitSinglesGroupsAction", () => {
  const roster = [{ playerId: "p1" }, { playerId: "p2" }, { playerId: "p3" }, { playerId: "p4" }];
  const matchups = [{ sideA: "p1", sideB: "p2", round: "Група 1" }];

  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await commitSinglesGroupsAction("t1", {}, matchups, false);
    expect(result.error).toBeDefined();
  });

  it("errors on an empty matchup list", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    const result = await commitSinglesGroupsAction("t1", {}, [], false);
    expect(result.error).toBeDefined();
  });

  it("rejects a matchup pitting a player against themself", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster);
    const result = await commitSinglesGroupsAction(
      "t1",
      {},
      [{ sideA: "p1", sideB: "p1", round: "Група 1" }],
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("rejects an out-of-range group assignment", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster);
    const result = await commitSinglesGroupsAction("t1", { p1: 7 }, matchups, false);
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("persists new group assignments and replaces matches on success", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster);

    const result = await commitSinglesGroupsAction("t1", { p3: 2 }, matchups, false);

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.tournamentParticipant.update).toHaveBeenCalledWith({
      where: { tournamentId_playerId: { tournamentId: "t1", playerId: "p3" } },
      data: { group: 2 },
    });
    expect(txMock.match.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
  });

  it("excludes withdrawn participants from the roster it validates matchups against", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster);

    await commitSinglesGroupsAction("t1", { p3: 2 }, matchups, false);

    expect(prismaMock.tournamentParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1", withdrawnAt: null } }),
    );
  });
});
