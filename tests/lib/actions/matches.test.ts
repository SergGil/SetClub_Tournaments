import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

// The transaction callback form (prisma.$transaction(async (tx) => {...})) gets
// its own mock client - the array form (prisma.$transaction([...])) instead
// passes already-invoked calls to the top-level prismaMock methods below.
const { txMock } = vi.hoisted(() => ({
  txMock: {
    matchSet: { deleteMany: vi.fn(), createMany: vi.fn() },
    match: { updateMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    matchPlayer: { createMany: vi.fn() },
    tournamentParticipant: { update: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournamentParticipant: { findMany: vi.fn() },
    match: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), count: vi.fn(), update: vi.fn() },
    matchPlayer: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    matchSet: { deleteMany: vi.fn(), createMany: vi.fn() },
    tournament: { findUnique: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(txMock);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock, updateTagMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  updateTagMock: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
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
  checkCompletedMatchesAcknowledged,
  commitDoublesMatchesAction,
  commitSinglesGroupsAction,
  commitSinglesRoundRobinAction,
  createMatchAction,
  deleteMatchAction,
  drawDoublesTeamsAction,
  drawSinglesGroupsAction,
  saveScoreAction,
  updateMatchAction,
} from "@/lib/actions/matches";

function matchFormData(overrides: Record<string, string | string[]> = {}) {
  const data: Record<string, string | string[]> = {
    tournamentId: "t1",
    matchType: "SINGLES",
    round: "",
    scheduledDate: "",
    sideAPlayerIds: ["p1"],
    sideBPlayerIds: ["p2"],
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
    else formData.set(key, value);
  }
  return formData;
}

function scoreFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    matchId: "m1",
    expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    retired: "false",
    retiredWinnerSide: "",
    setsJson: JSON.stringify([{ sideAGames: 6, sideBGames: 4 }]),
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  prismaMock.match.findFirst.mockResolvedValue(null);
  prismaMock.tournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
});

describe("createMatchAction", () => {
  it("returns an error for invalid input without touching the DB", async () => {
    const result = await createMatchAction({}, matchFormData({ tournamentId: "" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't a registered participant", async () => {
    const result = await createMatchAction({}, matchFormData({ sideBPlayerIds: ["ghost"] }));
    expect(result.error).toBe("Гравець не зареєстрований у цьому турнірі");
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate placement round", async () => {
    prismaMock.match.findFirst.mockResolvedValueOnce({ id: "existing" });
    const result = await createMatchAction({}, matchFormData({ round: "Фінал" }));
    expect(result.error).toContain("Фінал");
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error for a concurrent delete (foreign key violation)", async () => {
    prismaMock.match.create.mockRejectedValueOnce({ code: "P2003" });
    const result = await createMatchAction({}, matchFormData());
    expect(result.error).toContain("вже видалили");
  });

  it("surfaces a friendly error for a concurrent duplicate round (unique constraint)", async () => {
    prismaMock.match.create.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentId", "round"] },
    });
    const result = await createMatchAction({}, matchFormData({ round: "Фінал" }));
    expect(result.error).toContain("Фінал");
  });

  it("creates the match, logs it, and refreshes ratings on success", async () => {
    prismaMock.match.create.mockResolvedValueOnce({ id: "m1" });

    const result = await createMatchAction({}, matchFormData());

    expect(result).toEqual({ success: true });
    expect(prismaMock.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "t1",
        matchType: "SINGLES",
        players: { create: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "match.create" }));
    expect(updateTagMock).toHaveBeenCalled();
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });
});

describe("updateMatchAction", () => {
  it("returns an error when matchId is missing", async () => {
    const result = await updateMatchAction({}, matchFormData());
    expect(result.error).toBe("Матч не знайдено");
  });

  it("returns an error when the match doesn't exist", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce(null);
    const result = await updateMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("не знайдено");
  });

  it("keeps the score intact when the player lineup is unchanged", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ]);
    prismaMock.match.update.mockResolvedValueOnce({ tournamentId: "t1" });

    const result = await updateMatchAction({}, matchFormData({ matchId: "m1" }));

    expect(result.notice).toBeUndefined();
    expect(prismaMock.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
    );
    expect(prismaMock.matchSet.deleteMany).not.toHaveBeenCalled();
  });

  it("resets the score and warns when the player lineup changed", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p3" },
    ]);
    prismaMock.match.update.mockResolvedValueOnce({ tournamentId: "t1" });

    const result = await updateMatchAction({}, matchFormData({ matchId: "m1" }));

    expect(result.notice).toContain("скинуто");
    expect(prismaMock.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED", winnerSide: null }) }),
    );
    expect(prismaMock.matchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: "m1" } });
  });

  it("returns an error when the match was deleted concurrently", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([]);
    prismaMock.match.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("вже видалили");
  });

  it("returns a generic conflict message for a roster-race unique violation", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.matchPlayer.findMany.mockResolvedValueOnce([]);
    prismaMock.match.update.mockRejectedValueOnce({ code: "P2002", meta: { target: ["matchId", "side", "playerId"] } });
    const result = await updateMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("оновіть сторінку");
  });
});

describe("deleteMatchAction", () => {
  it("returns an error when matchId is missing", async () => {
    const result = await deleteMatchAction({}, new FormData());
    expect(result.error).toBe("Матч не знайдено");
  });

  it("returns an error when the match was already deleted", async () => {
    prismaMock.match.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("matchId", "m1");
    const result = await deleteMatchAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("deletes the match, logs it, and refreshes ratings", async () => {
    prismaMock.match.delete.mockResolvedValueOnce({ id: "m1", tournamentId: "t1" });
    const formData = new FormData();
    formData.set("matchId", "m1");

    const result = await deleteMatchAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "match.delete" }));
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });
});

describe("saveScoreAction", () => {
  it("returns an error for malformed JSON", async () => {
    const result = await saveScoreAction({}, scoreFormData({ setsJson: "{not json" }));
    expect(result.error).toBe("Некоректний рахунок");
  });

  it("returns field errors for an illegal set score", async () => {
    const result = await saveScoreAction(
      {},
      scoreFormData({ setsJson: JSON.stringify([{ sideAGames: 6, sideBGames: 6 }]) }),
    );
    expect(result.fieldErrors).toBeDefined();
  });

  it("rejects a tied match with no retirement", async () => {
    const result = await saveScoreAction(
      {},
      scoreFormData({
        setsJson: JSON.stringify([
          { sideAGames: 6, sideBGames: 4 },
          { sideAGames: 4, sideBGames: 6 },
        ]),
      }),
    );
    expect(result.error).toContain("рівний");
  });

  it("returns an error when the match doesn't exist", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce(null);
    const result = await saveScoreAction({}, scoreFormData());
    expect(result.error).toContain("не знайдено");
  });

  it("rejects a stale expectedUpdatedAt", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      tournamentId: "t1",
    });
    const result = await saveScoreAction({}, scoreFormData());
    expect(result.error).toContain("змінили в іншому місці");
  });

  it("rejects a concurrent save caught by the transactional check", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tournamentId: "t1",
    });
    txMock.match.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await saveScoreAction({}, scoreFormData());
    expect(result.error).toContain("змінили в іншому місці");
  });

  it("saves the score and logs a retirement-specific summary", async () => {
    prismaMock.match.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tournamentId: "t1",
    });
    txMock.match.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await saveScoreAction(
      {},
      scoreFormData({ retired: "true", retiredWinnerSide: "A", setsJson: "[]" }),
    );

    expect(result).toEqual({ success: true });
    expect(txMock.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", winnerSide: "A", retired: true }) }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("зняттям") }),
    );
  });
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

describe("checkCompletedMatchesAcknowledged", () => {
  it("returns null when there are no completed matches", async () => {
    prismaMock.match.count.mockResolvedValueOnce(0);
    expect(await checkCompletedMatchesAcknowledged("t1", false)).toBeNull();
  });

  it("returns a warning when completed matches exist and aren't acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    const message = await checkCompletedMatchesAcknowledged("t1", false);
    expect(message).toContain("2 завершених");
  });

  it("returns null once acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    expect(await checkCompletedMatchesAcknowledged("t1", true)).toBeNull();
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
});
