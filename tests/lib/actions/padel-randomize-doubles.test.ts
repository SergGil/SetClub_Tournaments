import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

const { txMock } = vi.hoisted(() => ({
  txMock: {
    padelMatch: { deleteMany: vi.fn(), createMany: vi.fn() },
    padelMatchPlayer: { createMany: vi.fn() },
    padelTournamentParticipant: { update: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelTournament: { findUnique: vi.fn() },
    padelTournamentParticipant: { findMany: vi.fn() },
    padelTournamentGroup: { findMany: vi.fn().mockResolvedValue([]) },
    padelMatch: { count: vi.fn() },
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

const { schedulePadelRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  schedulePadelRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/padel-snapshot", () => ({
  schedulePadelRatingSnapshotRefresh: schedulePadelRatingSnapshotRefreshMock,
}));

import {
  commitPadelDoublesGroupsAction,
  commitPadelDoublesMatchesAction,
  drawPadelDoublesGroupsAction,
  drawPadelDoublesTeamsAction,
} from "@/lib/actions/padel-randomize-doubles";

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

describe("drawPadelDoublesTeamsAction", () => {
  it("errors when the tournament doesn't exist", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce(null);
    const result = await drawPadelDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors for a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await drawPadelDoublesTeamsAction("t1");
    expect(result).toEqual({ ok: false, error: "Рандомайзер доступний лише для парних турнірів" });
  });

  it("errors with fewer than 4 participants", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants.slice(0, 3));
    const result = await drawPadelDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody is seeded", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(
      doublesParticipants.map((p) => ({ ...p, seed: null })),
    );
    const result = await drawPadelDoublesTeamsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("rejects a fixed pair with a player outside the roster", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants);
    const result = await drawPadelDoublesTeamsAction("t1", [["p1", "ghost"]]);
    expect(result.ok).toBe(false);
  });

  it("draws a valid set of teams and matchups with player names attached", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(doublesParticipants);
    const result = await drawPadelDoublesTeamsAction("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.matchups.length).toBeGreaterThan(0);
    expect(result.matchups[0].sideA.names).toHaveLength(2);
  });
});

describe("commitPadelDoublesMatchesAction", () => {
  const matchups = [{ sideAIds: ["p1", "p2"] as [string, string], sideBIds: ["p3", "p4"] as [string, string] }];

  it("errors for a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await commitPadelDoublesMatchesAction("t1", matchups, false);
    expect(result.error).toBeDefined();
  });

  it("errors on an empty matchup list", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await commitPadelDoublesMatchesAction("t1", [], false);
    expect(result.error).toBeDefined();
  });

  it("blocks the commit when completed matches aren't acknowledged", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.padelMatch.count.mockResolvedValueOnce(1);
    const result = await commitPadelDoublesMatchesAction("t1", matchups, false);
    expect(result.error).toContain("завершених матчів");
    expect(txMock.padelMatch.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a matchup referencing a player outside the roster", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.padelMatch.count.mockResolvedValueOnce(0);
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
    ]);
    const result = await commitPadelDoublesMatchesAction(
      "t1",
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "ghost"] }],
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("replaces matches and commits on success", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.padelMatch.count.mockResolvedValueOnce(0);
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);

    const result = await commitPadelDoublesMatchesAction("t1", matchups, false);

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.padelMatch.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(txMock.padelMatch.createMany).toHaveBeenCalled();
    expect(txMock.padelMatchPlayer.createMany).toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "padel.match.randomize" }));
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

describe("drawPadelDoublesGroupsAction", () => {
  it("errors for a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await drawPadelDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors with fewer than 4 participants", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants.slice(0, 3));
    const result = await drawPadelDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody has a group assigned", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, group: null })),
    );
    const result = await drawPadelDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("errors when nobody is seeded", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(
      groupedDoublesParticipants.map((p) => ({ ...p, seed: null })),
    );
    const result = await drawPadelDoublesGroupsAction("t1");
    expect(result.ok).toBe(false);
  });

  it("rejects a fixed pair whose two players are in different groups", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants);
    const result = await drawPadelDoublesGroupsAction("t1", [["p1", "p5"]]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("різних групах");
  });

  it("draws teams and matchups that never cross a group boundary", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce(groupedDoublesParticipants);
    const result = await drawPadelDoublesGroupsAction("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.groups.sort()).toEqual([1, 2]);
    for (const m of result.matchups) {
      expect(m.sideA.group).toBe(m.group);
      expect(m.sideB.group).toBe(m.group);
    }
  });
});

describe("commitPadelDoublesGroupsAction", () => {
  const matchups = [
    { sideAIds: ["p1", "p2"] as [string, string], sideBIds: ["p3", "p4"] as [string, string], group: 1 },
  ];

  it("errors for a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await commitPadelDoublesGroupsAction("t1", {}, matchups, false);
    expect(result.error).toBeDefined();
  });

  it("rejects an out-of-range group number", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.padelMatch.count.mockResolvedValueOnce(0);
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    const result = await commitPadelDoublesGroupsAction(
      "t1",
      {},
      [{ sideAIds: ["p1", "p2"], sideBIds: ["p3", "p4"], group: 7 }],
      false,
    );
    expect(result.error).toBe("Некоректні дані розіграшу");
  });

  it("persists newly-balanced groups and creates matches tagged with the group's round label on success", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES", startDate: new Date() });
    prismaMock.padelMatch.count.mockResolvedValueOnce(0);
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);

    const result = await commitPadelDoublesGroupsAction("t1", { p1: 1, p2: 1 }, matchups, false);

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.padelTournamentParticipant.update).toHaveBeenCalledTimes(2);
    expect(txMock.padelMatch.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ round: "Група A" })],
      }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "padel.match.randomize" }));
  });
});
