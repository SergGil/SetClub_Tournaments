import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

// A second, separate mock object for the interactive-transaction callback
// form (`prisma.$transaction(async (tx) => ...)`, used by
// withdrawParticipantAction) - same split as tests/lib/actions/matches.test.ts,
// so per-test method mocks on `tx.*` don't collide with the plain
// promise-array transactions the other actions in this file use.
const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    tournamentParticipant: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    match: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    matchPlayer: { deleteMany: vi.fn(), create: vi.fn() },
    matchSet: { deleteMany: vi.fn() },
    matchAdvancement: { count: vi.fn(), findMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return {
    txMock,
    prismaMock: {
      tournament: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
      tournamentParticipant: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      tournamentGroup: {
        count: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      tournamentGroupMember: { createMany: vi.fn() },
      match: { deleteMany: vi.fn() },
      player: { findUnique: vi.fn() },
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(txMock);
        return Promise.all(arg as Promise<unknown>[]);
      }),
    },
  };
});
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

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// Runs the deferred callback immediately (synchronously) so tests can assert
// on logAudit without needing to wait for a real post-response "after" phase.
vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

const { scheduleRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  scheduleRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/snapshot", () => ({
  scheduleRatingSnapshotRefresh: scheduleRatingSnapshotRefreshMock,
}));

const { checkCompletedMatchesAcknowledgedMock } = vi.hoisted(() => ({
  checkCompletedMatchesAcknowledgedMock: vi.fn(),
}));
vi.mock("@/lib/actions/match-randomize-shared", () => ({
  checkCompletedMatchesAcknowledged: checkCompletedMatchesAcknowledgedMock,
}));

import {
  addParticipantAction,
  createTournamentAction,
  createTournamentGroupAction,
  deleteTournamentAction,
  deleteTournamentGroupAction,
  removeParticipantAction,
  resetTournamentAction,
  setParticipantGroupAction,
  toggleParticipantSeedAction,
  updateTournamentAction,
  withdrawParticipantAction,
} from "@/lib/actions/tournaments";

function validFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    name: "Літній кубок",
    description: "",
    format: "SINGLES",
    status: "UPCOMING",
    surface: "HARD",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
});

describe("createTournamentAction", () => {
  it("returns field errors instead of hitting the database on invalid input", async () => {
    const result = await createTournamentAction({}, validFormData({ name: "" }));
    expect(result.fieldErrors?.name).toBeDefined();
    expect(prismaMock.tournament.create).not.toHaveBeenCalled();
  });

  it("creates the tournament, logs the audit entry, and redirects to its detail page", async () => {
    prismaMock.tournament.create.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });

    await createTournamentAction({}, validFormData());

    expect(prismaMock.tournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Літній кубок", createdById: "admin-1" }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "tournament.create", entityId: "t1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/tournaments");
    expect(revalidatePathMock).toHaveBeenCalledWith("/tournaments");
    expect(redirectMock).toHaveBeenCalledWith("/admin/tournaments/t1");
  });
});

describe("updateTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const formData = validFormData();
    formData.delete("id");
    const result = await updateTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("returns an error when the tournament doesn't exist", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce(null);
    const result = await updateTournamentAction({}, validFormData({ id: "t1" }));
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("blocks a format change once matches already exist", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({
      format: "SINGLES",
      _count: { matches: 3 },
    });
    const result = await updateTournamentAction({}, validFormData({ id: "t1", format: "DOUBLES" }));
    expect(result.fieldErrors?.format).toBeDefined();
    expect(prismaMock.tournament.update).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament was deleted concurrently", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", _count: { matches: 0 } });
    prismaMock.tournament.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateTournamentAction({}, validFormData({ id: "t1" }));
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
  });

  it("updates the tournament and refreshes ratings on success", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", _count: { matches: 0 } });
    prismaMock.tournament.update.mockResolvedValueOnce({});

    const result = await updateTournamentAction({}, validFormData({ id: "t1" }));

    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "tournament.update", entityId: "t1" }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });
});

describe("deleteTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deleteTournamentAction({}, new FormData());
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("blocks deletion when completed matches aren't acknowledged, without touching the DB", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce("У турнірі є 2 завершених матчів...");
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await deleteTournamentAction({}, formData);
    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.tournament.delete).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament was already deleted", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await deleteTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
  });

  it("deletes the tournament, logs it, and redirects to the list", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    const formData = new FormData();
    formData.set("id", "t1");

    await deleteTournamentAction({}, formData);

    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "tournament.delete", summary: expect.stringContaining("Літній кубок") }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/admin/tournaments");
  });
});

describe("resetTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await resetTournamentAction({}, new FormData());
    expect(result.error).toBe("Турнір не знайдено");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks reset when completed matches aren't acknowledged, without touching the DB", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce("У турнірі є 2 завершених матчів...");
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await resetTournamentAction({}, formData);
    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament doesn't exist", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.findUnique.mockResolvedValueOnce(null);
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await resetTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deletes matches and custom groups, clears the built-in group field, and keeps participants/seed", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ name: "Літній кубок" });
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 3 }, { count: 1 }, { count: 5 }]);
    const formData = new FormData();
    formData.set("id", "t1");

    const result = await resetTournamentAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(prismaMock.match.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(prismaMock.tournamentGroup.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(prismaMock.tournamentParticipant.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      data: { group: null },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "tournament.reset", summary: expect.stringContaining("Літній кубок") }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("addParticipantAction", () => {
  it("returns an error for an empty selection without touching the DB", async () => {
    const result = await addParticipantAction("t1", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("upserts every selected player and refreshes ratings", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const result = await addParticipantAction("t1", ["p1", "p2"]);

    expect(result).toEqual({});
    expect(prismaMock.tournamentParticipant.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.tournamentParticipant.upsert).toHaveBeenCalledWith({
      where: { tournamentId_playerId: { tournamentId: "t1", playerId: "p1" } },
      update: {},
      create: { tournamentId: "t1", playerId: "p1" },
    });
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("returns a friendly error when the tournament or a player was removed concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2003" });

    const result = await addParticipantAction("t1", ["p1"]);

    expect(result.error).toBe("Турнір або гравець не знайдено — можливо, їх вже видалили");
  });
});

describe("removeParticipantAction", () => {
  it("refuses to remove a participant who already has matches", async () => {
    prismaMock.tournamentParticipant.deleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await removeParticipantAction("t1", "p1");
    expect(result.error).toContain("уже має матчі");
  });

  it("removes the participant and logs their name when found", async () => {
    prismaMock.tournamentParticipant.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.player.findUnique.mockResolvedValueOnce({ name: "Іван" });

    const result = await removeParticipantAction("t1", "p1");

    expect(result).toEqual({});
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Іван") }),
    );
  });
});

describe("withdrawParticipantAction", () => {
  function withdrawFormData(overrides: Record<string, string> = {}) {
    const formData = new FormData();
    formData.set("tournamentId", "t1");
    formData.set("playerId", "p1");
    for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
    return formData;
  }

  beforeEach(() => {
    prismaMock.tournament.findUnique.mockResolvedValue({ format: "SINGLES" });
    prismaMock.tournamentParticipant.findUnique.mockResolvedValue({
      withdrawnAt: null,
      player: { name: "Іван" },
    });
    txMock.matchAdvancement.count.mockResolvedValue(0);
    // Default: the conditional updateMany that stamps withdrawnAt (guarded
    // by the advisory lock) matches exactly one row - see the dedicated
    // "concurrent double-submit" test below for the count:0 branch.
    txMock.tournamentParticipant.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns an error when the tournament or player id is missing", async () => {
    const result = await withdrawParticipantAction({}, new FormData());
    expect(result.error).toBe("Турнір або гравця не знайдено");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks withdrawal for a DOUBLES tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await withdrawParticipantAction({}, withdrawFormData());
    expect(result.error).toContain("парних турнірів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament doesn't exist", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce(null);
    const result = await withdrawParticipantAction({}, withdrawFormData());
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("returns an error when the participant doesn't exist", async () => {
    prismaMock.tournamentParticipant.findUnique.mockResolvedValueOnce(null);
    const result = await withdrawParticipantAction({}, withdrawFormData());
    expect(result.error).toContain("Учасника не знайдено");
  });

  it("returns an error when the participant is already withdrawn", async () => {
    prismaMock.tournamentParticipant.findUnique.mockResolvedValueOnce({
      withdrawnAt: new Date("2026-01-01"),
      player: { name: "Іван" },
    });
    const result = await withdrawParticipantAction({}, withdrawFormData());
    expect(result.error).toBe("Гравця вже знято з турніру");
  });

  it("reports 'already withdrawn' instead of double-closing matches when a concurrent submit wins the advisory lock race", async () => {
    // The pre-transaction check passed (withdrawnAt: null at read time), but
    // by the time this call reaches the lock, another concurrent submit
    // already committed the withdrawal - updateMany's WHERE (withdrawnAt:
    // null) then matches zero rows.
    txMock.tournamentParticipant.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await withdrawParticipantAction({}, withdrawFormData());

    expect(result.error).toBe("Гравця вже знято з турніру");
    expect(txMock.match.findMany).not.toHaveBeenCalled();
    expect(txMock.match.update).not.toHaveBeenCalled();
  });

  it("marks the participant withdrawn and closes their SCHEDULED matches as walkovers for the opponent", async () => {
    txMock.match.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
      },
    ]);

    const result = await withdrawParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.$executeRaw).toHaveBeenCalled();
    expect(txMock.tournamentParticipant.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1", playerId: "p1", withdrawnAt: null },
      data: { withdrawnAt: expect.any(Date) },
    });
    expect(txMock.match.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: {
        status: "COMPLETED",
        winnerSide: "B",
        walkover: true,
        completedAt: expect.any(Date),
      },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({
        action: "tournament.participant.withdraw",
        summary: expect.stringContaining("Іван"),
      }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("vacates an unpaired slot instead of awarding a walkover when the opponent side is still empty", async () => {
    txMock.match.findMany.mockResolvedValueOnce([
      { id: "m1", players: [{ side: "A", playerId: "p1" }] },
    ]);

    const result = await withdrawParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.matchPlayer.deleteMany).toHaveBeenCalledWith({
      where: { matchId: "m1", playerId: "p1" },
    });
    expect(txMock.match.update).not.toHaveBeenCalled();
  });

  it("only ever queries SCHEDULED matches for closing, leaving real COMPLETED results alone", async () => {
    txMock.match.findMany.mockResolvedValueOnce([]);

    const result = await withdrawParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SCHEDULED", tournamentId: "t1" }),
      }),
    );
    expect(txMock.match.update).not.toHaveBeenCalled();
  });

  it("returns cascadeResets and requires confirmation before resetting an already-COMPLETED downstream match", async () => {
    txMock.matchAdvancement.count.mockResolvedValue(1);
    txMock.match.findMany
      .mockResolvedValueOnce([
        { id: "m1", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      ])
      .mockResolvedValueOnce([
        { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "B", walkover: true, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
        { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", walkover: false, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
      ]);
    txMock.matchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, withdrawnAt: new Date("2026-01-01"), player: { name: "Іван" } },
      { playerId: "p2", group: null, withdrawnAt: null, player: { name: "Петро" } },
      { playerId: "p3", group: null, withdrawnAt: null, player: { name: "Олег" } },
    ]);

    const result = await withdrawParticipantAction({}, withdrawFormData());

    expect(result.error).toContain("скине рахунок");
    // Labels reflect the CURRENT (about-to-be-wiped) occupants of "final",
    // not the new player the withdrawal would fill it with - same contract
    // as saveScoreAction/deleteMatchAction's cascade warning.
    expect(result.cascadeResets).toEqual([
      { matchId: "final", round: "Фінал", sideALabel: "Іван", sideBLabel: "Олег" },
    ]);
    // The whole transaction rolled back - nothing committed.
    expect(txMock.matchPlayer.deleteMany).not.toHaveBeenCalled();
  });

  it("applies the fill and reset once acknowledgedCascadeReset is confirmed", async () => {
    txMock.matchAdvancement.count.mockResolvedValue(1);
    txMock.match.findMany
      .mockResolvedValueOnce([
        { id: "m1", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      ])
      .mockResolvedValueOnce([
        { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "B", walkover: true, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
        { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", walkover: false, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
      ]);
    txMock.matchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.tournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, withdrawnAt: new Date("2026-01-01"), player: { name: "Іван" } },
      { playerId: "p2", group: null, withdrawnAt: null, player: { name: "Петро" } },
      { playerId: "p3", group: null, withdrawnAt: null, player: { name: "Олег" } },
    ]);

    const result = await withdrawParticipantAction({}, withdrawFormData({ acknowledgedCascadeReset: "true" }));

    expect(result).toEqual({ success: true });
    expect(txMock.matchPlayer.deleteMany).toHaveBeenCalledWith({ where: { matchId: "final", side: "A" } });
    expect(txMock.matchPlayer.create).toHaveBeenCalledWith({
      data: { matchId: "final", side: "A", playerId: "p2" },
    });
    expect(txMock.matchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: { in: ["final"] } } });
    expect(txMock.match.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["final"] } },
      data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
    });
    // m1 (the withdrawn player's own SCHEDULED match) was still closed as a walkover.
    expect(txMock.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" } }),
    );
  });
});

describe("toggleParticipantSeedAction", () => {
  it("no-ops silently if the participant was removed concurrently", async () => {
    prismaMock.tournamentParticipant.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(toggleParticipantSeedAction("t1", "p1", true)).resolves.toBeUndefined();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("re-throws unexpected errors", async () => {
    prismaMock.tournamentParticipant.update.mockRejectedValueOnce(new Error("boom"));
    await expect(toggleParticipantSeedAction("t1", "p1", true)).rejects.toThrow("boom");
  });

  it("sets seed=1 when seeding and seed=null when unseeding", async () => {
    prismaMock.tournamentParticipant.update.mockResolvedValueOnce({ player: { name: "Іван" } });
    await toggleParticipantSeedAction("t1", "p1", true);
    expect(prismaMock.tournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { seed: 1 } }),
    );

    prismaMock.tournamentParticipant.update.mockResolvedValueOnce({ player: { name: "Іван" } });
    await toggleParticipantSeedAction("t1", "p1", false);
    expect(prismaMock.tournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { seed: null } }),
    );
  });
});

describe("setParticipantGroupAction", () => {
  it.each([0, 7, 1.5])("rejects an out-of-range group number (%s)", async (group) => {
    const result = await setParticipantGroupAction("t1", "p1", group);
    expect(result?.error).toBeDefined();
    expect(prismaMock.tournamentParticipant.update).not.toHaveBeenCalled();
  });

  it("allows clearing the group with null", async () => {
    prismaMock.tournamentParticipant.update.mockResolvedValueOnce({});
    const result = await setParticipantGroupAction("t1", "p1", null);
    expect(result).toBeUndefined();
    expect(prismaMock.tournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { group: null } }),
    );
  });

  it("no-ops silently if the participant was removed concurrently", async () => {
    prismaMock.tournamentParticipant.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(setParticipantGroupAction("t1", "p1", 2)).resolves.toBeUndefined();
  });
});

describe("createTournamentGroupAction", () => {
  beforeEach(() => {
    prismaMock.tournamentParticipant.aggregate.mockResolvedValue({ _max: { group: null } });
    prismaMock.tournamentGroup.aggregate.mockResolvedValue({ _max: { number: null } });
    prismaMock.tournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await createTournamentGroupAction("t1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't registered in the tournament", async () => {
    const result = await createTournamentGroupAction("t1", "Плейофф", ["ghost"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group and does not touch TournamentParticipant.group at all", async () => {
    const result = await createTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tournamentId: "t1", name: "Плейофф" }) }),
    );
    // The whole point: a player already in a built-in 1-6 group must keep
    // it - membership in a custom group is a separate, additional table.
    expect(prismaMock.tournamentParticipant.update).not.toHaveBeenCalled();
    expect(prismaMock.tournamentParticipant.updateMany).not.toHaveBeenCalled();
  });

  it("adds every picked player as a TournamentGroupMember of the new group", async () => {
    await createTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);

    const groupCreateCall = prismaMock.tournamentGroup.create.mock.calls[0][0];
    const newGroupId = groupCreateCall.data.id;
    expect(prismaMock.tournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: newGroupId, playerId: "p1" },
        { tournamentGroupId: newGroupId, playerId: "p2" },
      ],
    });
  });

  it("skips the membership write entirely when no players are picked", async () => {
    await createTournamentGroupAction("t1", "Плейофф", []);
    expect(prismaMock.tournamentGroupMember.createMany).not.toHaveBeenCalled();
  });

  it("picks the next group number past both the built-in range and any existing custom group", async () => {
    prismaMock.tournamentParticipant.aggregate.mockResolvedValueOnce({ _max: { group: 3 } });
    prismaMock.tournamentGroup.aggregate.mockResolvedValueOnce({ _max: { number: 9 } });

    await createTournamentGroupAction("t1", "Плейофф", []);

    expect(prismaMock.tournamentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 10 }) }),
    );
  });
});

describe("deleteTournamentGroupAction", () => {
  it("deletes the group when it belongs to the given tournament", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "t1", name: "Плейофф" });

    const result = await deleteTournamentGroupAction("t1", "g1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentGroup.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });

  it("rejects without deleting when the group doesn't exist", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce(null);

    const result = await deleteTournamentGroupAction("t1", "ghost");

    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.delete).not.toHaveBeenCalled();
  });

  it("rejects without deleting when the group belongs to a different tournament", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "other-tournament", name: "Х" });

    const result = await deleteTournamentGroupAction("t1", "g1");

    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.delete).not.toHaveBeenCalled();
  });
});
