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
    match: { updateMany: vi.fn() },
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournamentParticipant: { findMany: vi.fn() },
    match: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    matchPlayer: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    matchSet: { deleteMany: vi.fn(), createMany: vi.fn() },
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
  createMatchAction,
  deleteMatchAction,
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

