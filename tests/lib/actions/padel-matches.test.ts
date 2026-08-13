import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

const { txMock } = vi.hoisted(() => ({
  txMock: {
    padelMatchSet: { deleteMany: vi.fn(), createMany: vi.fn() },
    padelMatch: { updateMany: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    padelMatchAdvancement: { findMany: vi.fn() },
    padelTournamentParticipant: { findMany: vi.fn() },
    padelMatchPlayer: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelTournamentParticipant: { findMany: vi.fn() },
    padelMatch: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    padelMatchPlayer: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    padelMatchSet: { deleteMany: vi.fn(), createMany: vi.fn() },
    padelMatchAdvancement: { count: vi.fn() },
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
  createPadelMatchAction,
  deletePadelMatchAction,
  savePadelScoreAction,
  updatePadelMatchAction,
} from "@/lib/actions/padel-matches";

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
  prismaMock.padelMatch.findFirst.mockResolvedValue(null);
  prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
  prismaMock.padelMatchAdvancement.count.mockResolvedValue(0);
});

describe("createPadelMatchAction", () => {
  it("returns an error for invalid input without touching the DB", async () => {
    const result = await createPadelMatchAction({}, matchFormData({ tournamentId: "" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.padelMatch.create).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't a registered participant", async () => {
    const result = await createPadelMatchAction({}, matchFormData({ sideBPlayerIds: ["ghost"] }));
    expect(result.error).toBe("Гравець не зареєстрований у цьому турнірі");
    expect(prismaMock.padelMatch.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate placement round", async () => {
    prismaMock.padelMatch.findFirst.mockResolvedValueOnce({ id: "existing" });
    const result = await createPadelMatchAction({}, matchFormData({ round: "Фінал" }));
    expect(result.error).toContain("Фінал");
    expect(prismaMock.padelMatch.create).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error for a concurrent delete (foreign key violation)", async () => {
    prismaMock.padelMatch.create.mockRejectedValueOnce({ code: "P2003" });
    const result = await createPadelMatchAction({}, matchFormData());
    expect(result.error).toContain("вже видалили");
  });

  it("surfaces a friendly error for a concurrent duplicate round (unique constraint)", async () => {
    prismaMock.padelMatch.create.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentId", "round"] },
    });
    const result = await createPadelMatchAction({}, matchFormData({ round: "Фінал" }));
    expect(result.error).toContain("Фінал");
  });

  it("creates the match, logs it, and refreshes ratings on success", async () => {
    prismaMock.padelMatch.create.mockResolvedValueOnce({ id: "m1" });

    const result = await createPadelMatchAction({}, matchFormData());

    expect(result).toEqual({ success: true });
    expect(prismaMock.padelMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: "t1",
        matchType: "SINGLES",
        players: { create: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "padel.match.create" }));
    expect(updateTagMock).toHaveBeenCalled();
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("creates a playerless placeholder match (both sides left unpicked) instead of rejecting an empty-string slot", async () => {
    prismaMock.padelMatch.create.mockResolvedValueOnce({ id: "m1" });

    const result = await createPadelMatchAction(
      {},
      matchFormData({ round: "Втішний півфінал", sideAPlayerIds: [""], sideBPlayerIds: [""] }),
    );

    expect(result).toEqual({ success: true });
    expect(prismaMock.padelMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ players: { create: [] } }),
    });
  });
});

describe("updatePadelMatchAction", () => {
  it("returns an error when matchId is missing", async () => {
    const result = await updatePadelMatchAction({}, matchFormData());
    expect(result.error).toBe("Матч не знайдено");
  });

  it("returns an error when the match doesn't exist", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce(null);
    const result = await updatePadelMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("не знайдено");
  });

  it("keeps the score intact when the player lineup is unchanged", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ]);
    prismaMock.padelMatch.update.mockResolvedValueOnce({ tournamentId: "t1" });

    const result = await updatePadelMatchAction({}, matchFormData({ matchId: "m1" }));

    expect(result.notice).toBeUndefined();
    expect(prismaMock.padelMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
    );
    expect(prismaMock.padelMatchSet.deleteMany).not.toHaveBeenCalled();
  });

  it("resets the score and warns when the player lineup changed", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p3" },
    ]);
    prismaMock.padelMatch.update.mockResolvedValueOnce({ tournamentId: "t1" });

    const result = await updatePadelMatchAction({}, matchFormData({ matchId: "m1" }));

    expect(result.notice).toContain("скинуто");
    expect(prismaMock.padelMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED", winnerSide: null }) }),
    );
    expect(prismaMock.padelMatchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: "m1" } });
  });

  it("clears the players (both sides left unpicked) instead of rejecting an empty-string slot", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([
      { side: "A", playerId: "p1" },
      { side: "B", playerId: "p2" },
    ]);
    prismaMock.padelMatch.update.mockResolvedValueOnce({ tournamentId: "t1" });

    const result = await updatePadelMatchAction(
      {},
      matchFormData({ matchId: "m1", sideAPlayerIds: [""], sideBPlayerIds: [""] }),
    );

    expect(result.notice).toContain("скинуто");
    expect(prismaMock.padelMatchPlayer.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("returns an error when the match was deleted concurrently", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([]);
    prismaMock.padelMatch.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updatePadelMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("вже видалили");
  });

  it("returns a generic conflict message for a roster-race unique violation", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchPlayer.findMany.mockResolvedValueOnce([]);
    prismaMock.padelMatch.update.mockRejectedValueOnce({ code: "P2002", meta: { target: ["matchId", "side", "playerId"] } });
    const result = await updatePadelMatchAction({}, matchFormData({ matchId: "m1" }));
    expect(result.error).toContain("оновіть сторінку");
  });
});

describe("deletePadelMatchAction", () => {
  it("returns an error when matchId is missing", async () => {
    const result = await deletePadelMatchAction({}, new FormData());
    expect(result.error).toBe("Матч не знайдено");
  });

  it("returns an error when the match was already deleted", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    txMock.padelMatch.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("matchId", "m1");
    const result = await deletePadelMatchAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("deletes the match, logs it, and refreshes ratings", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    txMock.padelMatch.delete.mockResolvedValueOnce({ id: "m1", tournamentId: "t1" });
    const formData = new FormData();
    formData.set("matchId", "m1");

    const result = await deletePadelMatchAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "padel.match.delete" }));
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("returns an error when the match no longer exists before the transaction starts", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce(null);
    const formData = new FormData();
    formData.set("matchId", "m1");
    const result = await deletePadelMatchAction({}, formData);
    expect(result.error).toContain("вже видалили");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("clears a downstream bracket slot without confirmation when nothing already COMPLETED depends on it", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchAdvancement.count.mockResolvedValueOnce(1);
    txMock.padelMatch.findMany.mockResolvedValueOnce([
      { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
      { id: "final", round: "Фінал", status: "SCHEDULED", winnerSide: null, players: [{ side: "A", playerId: "p1" }], sets: [] },
    ]);
    txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, player: { name: "Гравець 1" } },
      { playerId: "p2", group: null, player: { name: "Гравець 2" } },
    ]);
    txMock.padelMatch.delete.mockResolvedValueOnce({ id: "m1", tournamentId: "t1" });

    const formData = new FormData();
    formData.set("matchId", "m1");
    const result = await deletePadelMatchAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatchPlayer.deleteMany).toHaveBeenCalledWith({ where: { matchId: "final", side: "A" } });
    expect(txMock.padelMatchPlayer.create).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting a match that would reset an already-COMPLETED downstream match", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchAdvancement.count.mockResolvedValueOnce(1);
    txMock.padelMatch.findMany.mockResolvedValueOnce([
      { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
      { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
    ]);
    txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, player: { name: "Гравець 1" } },
      { playerId: "p2", group: null, player: { name: "Гравець 2" } },
      { playerId: "p3", group: null, player: { name: "Гравець 3" } },
    ]);

    const formData = new FormData();
    formData.set("matchId", "m1");
    const result = await deletePadelMatchAction({}, formData);

    expect(result.error).toContain("скине рахунок");
    expect(result.cascadeResets).toEqual([
      { matchId: "final", round: "Фінал", sideALabel: "Гравець 1", sideBLabel: "Гравець 3" },
    ]);
    expect(txMock.padelMatch.delete).not.toHaveBeenCalled();
  });

  it("clears the downstream match's stale result and deletes once the cascade reset is confirmed", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });
    prismaMock.padelMatchAdvancement.count.mockResolvedValueOnce(1);
    txMock.padelMatch.findMany.mockResolvedValueOnce([
      { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
      { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
    ]);
    txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, player: { name: "Гравець 1" } },
      { playerId: "p2", group: null, player: { name: "Гравець 2" } },
      { playerId: "p3", group: null, player: { name: "Гравець 3" } },
    ]);
    txMock.padelMatch.delete.mockResolvedValueOnce({ id: "m1", tournamentId: "t1" });

    const formData = new FormData();
    formData.set("matchId", "m1");
    formData.set("acknowledgedCascadeReset", "true");
    const result = await deletePadelMatchAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatchPlayer.deleteMany).toHaveBeenCalledWith({ where: { matchId: "final", side: "A" } });
    expect(txMock.padelMatchPlayer.create).not.toHaveBeenCalled();
    expect(txMock.padelMatchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: { in: ["final"] } } });
    expect(txMock.padelMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["final"] } },
      data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
    });
    expect(txMock.padelMatch.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

describe("savePadelScoreAction", () => {
  it("returns an error for malformed JSON", async () => {
    const result = await savePadelScoreAction({}, scoreFormData({ setsJson: "{not json" }));
    expect(result.error).toBe("Некоректний рахунок");
  });

  it("returns field errors for an illegal set score", async () => {
    const result = await savePadelScoreAction(
      {},
      scoreFormData({ setsJson: JSON.stringify([{ sideAGames: 6, sideBGames: 6 }]) }),
    );
    expect(result.fieldErrors).toBeDefined();
  });

  it("rejects a tied match with no retirement", async () => {
    const result = await savePadelScoreAction(
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
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce(null);
    const result = await savePadelScoreAction({}, scoreFormData());
    expect(result.error).toContain("не знайдено");
  });

  it("returns a friendly error when the match is deleted concurrently inside the transaction", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tournamentId: "t1",
    });
    txMock.padelMatchSet.deleteMany.mockRejectedValueOnce({ code: "P2025" });
    const result = await savePadelScoreAction({}, scoreFormData());
    expect(result.error).toContain("вже видалили");
  });

  it("rejects a stale expectedUpdatedAt", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      tournamentId: "t1",
    });
    const result = await savePadelScoreAction({}, scoreFormData());
    expect(result.error).toContain("змінили в іншому місці");
  });

  it("rejects a concurrent save caught by the transactional check", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tournamentId: "t1",
    });
    txMock.padelMatch.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await savePadelScoreAction({}, scoreFormData());
    expect(result.error).toContain("змінили в іншому місці");
  });

  it("saves the score and logs a retirement-specific summary", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce({
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tournamentId: "t1",
    });
    txMock.padelMatch.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await savePadelScoreAction(
      {},
      scoreFormData({ retired: "true", retiredWinnerSide: "A", setsJson: "[]" }),
    );

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", winnerSide: "A", retired: true }) }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("зняттям") }),
    );
  });

  describe("bracket-advancement cascade (GROUPS_12_PLAYOFF tournaments only)", () => {
    function mockBracketSnapshot() {
      txMock.padelMatch.findMany.mockResolvedValueOnce([
        {
          id: "m1",
          round: null,
          status: "COMPLETED",
          winnerSide: "A",
          players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
          sets: [{ sideAGames: 6, sideBGames: 4 }],
        },
        {
          id: "d1",
          round: "1/2",
          status: "COMPLETED",
          winnerSide: "A",
          players: [{ side: "A", playerId: "oldwinner" }, { side: "B", playerId: "z" }],
          sets: [{ sideAGames: 6, sideBGames: 0 }],
        },
      ]);
      txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
        {
          matchId: "d1",
          side: "A",
          source: "MATCH_RESULT",
          sourceGroup: null,
          sourceRank: null,
          sourceMatchId: "m1",
          outcome: "WINNER",
        },
      ]);
      txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
        { playerId: "p1", group: null, player: { name: "П1" } },
        { playerId: "p2", group: null, player: { name: "П2" } },
        { playerId: "oldwinner", group: null, player: { name: "Старий" } },
        { playerId: "z", group: null, player: { name: "Z" } },
      ]);
    }

    function findScoreArgs() {
      return {
        completedAt: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        tournamentId: "t1",
      };
    }

    it("does not query the bracket at all for a tournament with no MatchAdvancement rows", async () => {
      prismaMock.padelMatch.findUnique.mockResolvedValueOnce(findScoreArgs());
      txMock.padelMatch.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await savePadelScoreAction({}, scoreFormData());

      expect(result).toEqual({ success: true });
      expect(txMock.padelMatch.findMany).not.toHaveBeenCalled();
    });

    it("blocks the save and returns cascadeResets when a downstream COMPLETED match would be reset without confirmation", async () => {
      prismaMock.padelMatchAdvancement.count.mockResolvedValueOnce(1);
      prismaMock.padelMatch.findUnique.mockResolvedValueOnce(findScoreArgs());
      txMock.padelMatch.updateMany.mockResolvedValue({ count: 1 });
      mockBracketSnapshot();

      const result = await savePadelScoreAction({}, scoreFormData());

      expect(result.error).toBeDefined();
      expect(result.cascadeResets).toEqual([
        { matchId: "d1", round: "1/2", sideALabel: "Старий", sideBLabel: "Z" },
      ]);
      expect(txMock.padelMatchPlayer.deleteMany).not.toHaveBeenCalled();
    });

    it("applies the fill and the cascade reset once acknowledgedCascadeReset is confirmed", async () => {
      prismaMock.padelMatchAdvancement.count.mockResolvedValueOnce(1);
      prismaMock.padelMatch.findUnique.mockResolvedValueOnce(findScoreArgs());
      txMock.padelMatch.updateMany.mockResolvedValue({ count: 1 });
      mockBracketSnapshot();

      const result = await savePadelScoreAction(
        {},
        scoreFormData({ acknowledgedCascadeReset: "true" }),
      );

      expect(result).toEqual({ success: true });
      expect(txMock.padelMatchPlayer.deleteMany).toHaveBeenCalledWith({ where: { matchId: "d1", side: "A" } });
      expect(txMock.padelMatchPlayer.create).toHaveBeenCalledWith({
        data: { matchId: "d1", side: "A", playerId: "p1" },
      });
      expect(txMock.padelMatchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: { in: ["d1"] } } });
      expect(txMock.padelMatch.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["d1"] } },
        data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
      });
    });
  });
});
