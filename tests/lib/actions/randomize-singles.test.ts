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
  drawSinglesSeededGroupsAction,
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

describe("drawSinglesSeededGroupsAction", () => {
  /** n participants, the first `seeded` of them seeded. */
  const roster = (n: number, seeded: number) =>
    Array.from({ length: n }, (_, i) => ({
      playerId: `p${i + 1}`,
      seed: i < seeded ? i + 1 : null,
      player: { name: `Гравець ${i + 1}`, nickname: null },
    }));

  it("rejects a group count outside 2..6", async () => {
    for (const groupCount of [1, 7, 2.5, Number.NaN]) {
      const result = await drawSinglesSeededGroupsAction("t1", groupCount);
      expect(result.ok).toBe(false);
    }
    expect(prismaMock.tournament.findUnique).not.toHaveBeenCalled();
  });

  it("errors for a non-singles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    expect((await drawSinglesSeededGroupsAction("t1", 4)).ok).toBe(false);
  });

  it("errors when nobody is seeded", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster(8, 0));
    const result = await drawSinglesSeededGroupsAction("t1", 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("сіяного");
  });

  it("errors when there are fewer than 2 players per group", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster(7, 4));
    const result = await drawSinglesSeededGroupsAction("t1", 4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("щонайменше 8");
  });

  it("deals 12 players (8 seeded + 4 unseeded) into 4 groups of 2 seeded + 1 unseeded, with a round robin per group", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster(12, 8));

    const result = await drawSinglesSeededGroupsAction("t1", 4);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // Withdrawn participants are excluded from the draw.
    expect(prismaMock.tournamentParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1", withdrawnAt: null } }),
    );
    expect(result.existingGroups.map((g) => g.group)).toEqual([1, 2, 3, 4]);
    expect(result.revealOrder).toHaveLength(12);
    // Seeded players are revealed first.
    expect(result.revealOrder.slice(0, 8).every((p) => Number(p.playerId.slice(1)) <= 8)).toBe(true);

    const seededPerGroup = new Map<number, number>();
    const unseededPerGroup = new Map<number, number>();
    for (const [playerId, group] of Object.entries(result.groupAssignment)) {
      const isSeeded = Number(playerId.slice(1)) <= 8;
      const map = isSeeded ? seededPerGroup : unseededPerGroup;
      map.set(group, (map.get(group) ?? 0) + 1);
    }
    expect([...seededPerGroup.values()]).toEqual([2, 2, 2, 2]);
    expect([...unseededPerGroup.values()]).toEqual([1, 1, 1, 1]);

    // 4 groups of 3 -> 3 matches each = 12, all labeled by group, none across groups.
    expect(result.matchups).toHaveLength(12);
    for (const m of result.matchups) {
      expect(result.groupAssignment[m.sideA.playerId]).toBe(result.groupAssignment[m.sideB.playerId]);
      expect(m.round).toMatch(/^Група [A-D]$/);
    }
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

describe("commitSinglesGroupsAction audit label", () => {
  it("records which strategy produced the draw", async () => {
    const roster = [{ playerId: "p1" }, { playerId: "p2" }];
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(roster);

    await commitSinglesGroupsAction(
      "t1",
      { p1: 1, p2: 1 },
      [{ sideA: "p1", sideB: "p2", round: "Група A" }],
      false,
      undefined,
      "SEEDED_GROUPS",
    );

    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("SEEDED_GROUPS") }),
    );
  });
});
