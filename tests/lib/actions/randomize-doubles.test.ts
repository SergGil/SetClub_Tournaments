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
  commitDoublesGroupsAction,
  commitDoublesMatchesAction,
  drawDoublesGroupsAction,
  drawDoublesTeamsAction,
} from "@/lib/actions/randomize-doubles";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
});

const doublesParticipants = [
  { playerId: "p1", seed: 1, player: { name: "Іван" } },
  { playerId: "p2", seed: null, player: { name: "Петро" } },
  { playerId: "p3", seed: 1, player: { name: "Олег" } },
  { playerId: "p4", seed: null, player: { name: "Марко" } },
];

describe("drawDoublesTeamsAction", () => {
  it("errors when the tournament doesn't exist", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce(null);
    const result = await drawDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors for a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await drawDoublesTeamsAction("t1");
    expect(result).toEqual({ ok: false, error: "Рандомайзер доступний лише для парних турнірів" });
  });

  it("errors with fewer than 4 participants", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants.slice(0, 3));
    const result = await drawDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody is seeded", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      doublesParticipants.map((p) => ({ ...p, seed: null })),
    );
    const result = await drawDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("rejects a fixed pair with a player outside the roster", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants);
    const result = await drawDoublesTeamsAction("t1", [["p1", "ghost"]]);
    expect(result.ok).toBe(false);
  });

  it("draws a valid set of teams and matchups with player names attached", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants);
    const result = await drawDoublesTeamsAction("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.matchups.length).toBeGreaterThan(0);
    expect(result.matchups[0].sideA.names).toHaveLength(2);
  });
});

describe("commitDoublesMatchesAction", () => {
  const matchups = [{ sideAIds: ["p1", "p2"] as [string, string], sideBIds: ["p3", "p4"] as [string, string] }];

  it("errors for a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await commitDoublesMatchesAction("t1", matchups, false);
    expect(result.error).toBeDefined();
  });

  it("errors on an empty matchup list", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await commitDoublesMatchesAction("t1", [], false);
    expect(result.error).toBeDefined();
  });

  it("blocks the commit when completed matches aren't acknowledged", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(1);
    const result = await commitDoublesMatchesAction("t1", matchups, false);
    expect(result.error).toContain("завершених матчів");
    expect(txMock.match.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a matchup referencing a player outside the roster", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
    ]);
    const result = await commitDoublesMatchesAction(
      "t1",
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "ghost"] }],
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("replaces matches and commits on success", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);

    const result = await commitDoublesMatchesAction("t1", matchups, false);

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.match.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(txMock.match.createMany).toHaveBeenCalled();
    expect(txMock.matchPlayer.createMany).toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "match.randomize" }));
  });
});

const groupedDoublesParticipants = [
  { playerId: "p1", seed: 1, group: 1, player: { name: "Іван" } },
  { playerId: "p2", seed: null, group: 1, player: { name: "Петро" } },
  { playerId: "p3", seed: 1, group: 1, player: { name: "Олег" } },
  { playerId: "p4", seed: null, group: 1, player: { name: "Марко" } },
  { playerId: "p5", seed: 1, group: 2, player: { name: "Назар" } },
  { playerId: "p6", seed: null, group: 2, player: { name: "Тарас" } },
  { playerId: "p7", seed: 1, group: 2, player: { name: "Юрій" } },
  { playerId: "p8", seed: null, group: 2, player: { name: "Богдан" } },
];

describe("drawDoublesGroupsAction", () => {
  it("errors for a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await drawDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors with fewer than 4 participants", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants.slice(0, 3));
    const result = await drawDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody has a group assigned", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, group: null })),
    );
    const result = await drawDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody is seeded", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, seed: null })),
    );
    const result = await drawDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("rejects a fixed pair whose two players are in different groups", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants);
    const result = await drawDoublesGroupsAction("t1", [["p1", "p5"]]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("різних групах");
  });

  it("draws teams and matchups that never cross a group boundary", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants);
    const result = await drawDoublesGroupsAction("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.groups.sort()).toEqual([1, 2]);
    for (const m of result.matchups) {
      expect(m.sideA.group).toBe(m.group);
      expect(m.sideB.group).toBe(m.group);
    }
  });

  it("errors when nobody has a group and no valid groupCount is given", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, group: null })),
    );
    const result = await drawDoublesGroupsAction("t1", [], 1);
    expect(result.ok).toBe(false);
  });

  it("randomly splits into groupCount fresh groups when nobody has a group assigned", async () => {
    // 8 participants split evenly into 2 groups of 4 each - enough for 2
    // teams (and so at least 1 matchup) per group, whichever way the random
    // split lands.
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, group: null })),
    );
    const result = await drawDoublesGroupsAction("t1", [], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.groups.length).toBeGreaterThan(0);
    for (const group of result.groups) {
      expect(group).toBeGreaterThanOrEqual(1);
      expect(group).toBeLessThanOrEqual(2);
    }
  });

  it("keeps a fixed pair together in the same fresh group when splitting by groupCount", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, group: null })),
    );
    const result = await drawDoublesGroupsAction("t1", [["p1", "p2"]], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.groupAssignment.p1).toBe(result.groupAssignment.p2);
  });
});

describe("commitDoublesGroupsAction", () => {
  const matchups = [
    { sideAIds: ["p1", "p2"] as [string, string], sideBIds: ["p3", "p4"] as [string, string], group: 1 },
  ];

  it("errors for a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await commitDoublesGroupsAction("t1", {}, matchups, false);
    expect(result.error).toBeDefined();
  });

  it("rejects an out-of-range group number", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    const result = await commitDoublesGroupsAction(
      "t1",
      {},
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"], group: 7 }],
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("persists newly-balanced groups and creates matches tagged with the group's round label on success", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.match.count.mockResolvedValueOnce(0);
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);

    const result = await commitDoublesGroupsAction("t1", { p1: 1, p2: 1 }, matchups, false);

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.tournamentParticipant.update).toHaveBeenCalledTimes(2);
    expect(txMock.match.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ round: "Група A" })],
      }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "match.randomize" }));
  });
});
