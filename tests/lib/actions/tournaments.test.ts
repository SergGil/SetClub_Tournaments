import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

// A second, separate mock object for the interactive-transaction callback
// form (`prisma.$transaction(async (tx) => ...)`, used by
// withdrawParticipantAction) - same split as tests/lib/actions/matches.test.ts,
// so per-test method mocks on `tx.*` don't collide with the plain
// promise-array transactions the other actions in this file use.
const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    tournamentParticipant: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    tournamentGroup: { update: vi.fn() },
    tournamentGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    match: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    matchPlayer: { deleteMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
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
        update: vi.fn(),
        aggregate: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      tournamentGroupMember: { createMany: vi.fn(), deleteMany: vi.fn() },
      match: { deleteMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
      matchPlayer: { createMany: vi.fn() },
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

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObject: deleteObjectMock }));

import {
  addParticipantAction,
  createTournamentAction,
  createTournamentGroupAction,
  createTournamentGroupWithPairsAction,
  deleteTournamentAction,
  deleteTournamentGroupAction,
  removeParticipantAction,
  resetTournamentAction,
  setParticipantGroupAction,
  toggleParticipantSeedAction,
  updateTournamentAction,
  updateTournamentGroupAction,
  updateTournamentGroupPairsAction,
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
  deleteObjectMock.mockResolvedValue(undefined);
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
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ photos: [] });
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

  // Regression test: Photo rows cascade-delete at the DB level
  // (onDelete: Cascade) the moment the Tournament row is deleted, which
  // would silently orphan their R2 objects forever if nothing read the keys
  // first - see the comment on deleteTournamentAction itself.
  it("cleans up every photo's R2 object after deleting a tournament that had photos", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.findUnique.mockResolvedValueOnce({
      photos: [{ key: "tournaments/t1/a.jpg" }, { key: "tournaments/t1/b.jpg" }],
    });
    prismaMock.tournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    const formData = new FormData();
    formData.set("id", "t1");

    await deleteTournamentAction({}, formData);

    expect(deleteObjectMock).toHaveBeenCalledWith("tournaments/t1/a.jpg");
    expect(deleteObjectMock).toHaveBeenCalledWith("tournaments/t1/b.jpg");
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
  });

  it("still deletes and redirects even if an R2 cleanup call fails", async () => {
    checkCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ photos: [{ key: "tournaments/t1/a.jpg" }] });
    prismaMock.tournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    deleteObjectMock.mockRejectedValueOnce(new Error("network error"));
    const formData = new FormData();
    formData.set("id", "t1");

    await deleteTournamentAction({}, formData);

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

  it("reports a retryable number race distinctly from a duplicate member on a P2002", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentId", "number"] },
    });
    const result = await createTournamentGroupAction("t1", "Плейофф", []);
    expect(result.error).toContain("спробуйте ще раз");
  });

  it("reports a duplicate picked player distinctly from a group-number race on a P2002", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentGroupId", "playerId"] },
    });
    const result = await createTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);
    expect(result.error).toBe("Один із гравців обраний двічі");
  });
});

describe("createTournamentGroupWithPairsAction", () => {
  beforeEach(() => {
    prismaMock.tournamentParticipant.aggregate.mockResolvedValue({ _max: { group: null } });
    prismaMock.tournamentGroup.aggregate.mockResolvedValue({ _max: { number: null } });
    prismaMock.tournamentParticipant.findMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    prismaMock.tournament.findUnique.mockResolvedValue({ format: "DOUBLES", startDate: new Date("2026-01-01") });
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await createTournamentGroupWithPairsAction("t1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: null });
    const result = await createTournamentGroupWithPairsAction("t1", "Плейофф", [["p1", "p2"]]);
    expect(result.error).toContain("парного турніру");
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a pair with a player outside the roster", async () => {
    const result = await createTournamentGroupWithPairsAction("t1", "Плейофф", [["p1", "ghost"]]);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a player used in two pairs at once", async () => {
    const result = await createTournamentGroupWithPairsAction("t1", "Плейофф", [
      ["p1", "p2"],
      ["p1", "p3"],
    ]);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group, its membership from the flattened pairs, and the full round robin", async () => {
    const result = await createTournamentGroupWithPairsAction("t1", "Гра за 1-3", [
      ["p1", "p2"],
      ["p3", "p4"],
    ]);

    expect(result).toEqual({ success: true, matchCount: 1 });
    const groupCreateCall = prismaMock.tournamentGroup.create.mock.calls[0][0];
    const newGroupId = groupCreateCall.data.id;
    expect(prismaMock.tournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: newGroupId, playerId: "p1" },
        { tournamentGroupId: newGroupId, playerId: "p2" },
        { tournamentGroupId: newGroupId, playerId: "p3" },
        { tournamentGroupId: newGroupId, playerId: "p4" },
      ],
    });
    expect(prismaMock.match.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tournamentId: "t1", matchType: "DOUBLES", round: "Гра за 1-3" })],
    });
    expect(prismaMock.matchPlayer.createMany).toHaveBeenCalled();
  });

  it("creates the group with no matches when fewer than 2 pairs are given", async () => {
    const result = await createTournamentGroupWithPairsAction("t1", "Гра за 1-3", [["p1", "p2"]]);
    expect(result).toEqual({ success: true, matchCount: 0 });
    expect(prismaMock.match.createMany).not.toHaveBeenCalled();
  });
});

describe("updateTournamentGroupAction", () => {
  beforeEach(() => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValue({ tournamentId: "t1" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await updateTournamentGroupAction("t1", "g1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects without updating when the group doesn't exist", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce(null);

    const result = await updateTournamentGroupAction("t1", "ghost", "Плейофф", []);

    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects without updating when the group belongs to a different tournament", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "other-tournament" });

    const result = await updateTournamentGroupAction("t1", "g1", "Плейофф", []);

    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't registered in the tournament", async () => {
    const result = await updateTournamentGroupAction("t1", "g1", "Плейофф", ["ghost"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("renames the group and replaces its membership wholesale, without touching its number", async () => {
    const result = await updateTournamentGroupAction("t1", "g1", "Новий Плейофф", ["p1", "p2"]);

    expect(result.error).toBeUndefined();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.tournamentGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Новий Плейофф" },
    });
    expect(prismaMock.tournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
    expect(prismaMock.tournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: "g1", playerId: "p1" },
        { tournamentGroupId: "g1", playerId: "p2" },
      ],
    });
  });

  it("skips the membership write entirely when no players are picked", async () => {
    await updateTournamentGroupAction("t1", "g1", "Плейофф", []);
    expect(prismaMock.tournamentGroupMember.createMany).not.toHaveBeenCalled();
    expect(prismaMock.tournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
  });

  it("reports a friendly error when the group was deleted concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2025" });

    const result = await updateTournamentGroupAction("t1", "g1", "Плейофф", []);

    expect(result.error).toContain("вже видалили");
  });

  it("reports a friendly error when playerIds contains a duplicate", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentGroupId", "playerId"] },
    });

    const result = await updateTournamentGroupAction("t1", "g1", "Плейофф", ["p1", "p1"]);

    expect(result.error).toBe("Один із гравців обраний двічі");
  });
});

describe("updateTournamentGroupPairsAction", () => {
  beforeEach(() => {
    prismaMock.tournament.findUnique.mockResolvedValue({ format: "DOUBLES", startDate: new Date("2026-01-01") });
    prismaMock.tournamentGroup.findUnique.mockResolvedValue({ tournamentId: "t1", name: "Гра за 1-3" });
    prismaMock.tournamentParticipant.findMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    prismaMock.match.count.mockResolvedValue(0);
  });

  it("rejects an empty name without updating", async () => {
    const result = await updateTournamentGroupPairsAction("t1", "g1", "   ", [], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-doubles tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: null });
    const result = await updateTournamentGroupPairsAction("t1", "g1", "Плейофф", [], false);
    expect(result.error).toContain("парного турніру");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the group doesn't exist", async () => {
    prismaMock.tournamentGroup.findUnique.mockResolvedValueOnce(null);
    const result = await updateTournamentGroupPairsAction("t1", "ghost", "Плейофф", [], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a pair with a player outside the roster", async () => {
    const result = await updateTournamentGroupPairsAction("t1", "g1", "Плейофф", [["p1", "ghost"]], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks the update when the group's own matches include a completed one, unless acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    const result = await updateTournamentGroupPairsAction(
      "t1",
      "g1",
      "Гра за 1-3",
      [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      false,
    );
    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("proceeds once completed matches are acknowledged", async () => {
    prismaMock.match.count.mockResolvedValueOnce(2);
    const result = await updateTournamentGroupPairsAction(
      "t1",
      "g1",
      "Гра за 1-3",
      [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      true,
    );
    expect(result.success).toBe(true);
  });

  it("renames the group, replaces its membership, and regenerates only this group's own matches", async () => {
    const result = await updateTournamentGroupPairsAction(
      "t1",
      "g1",
      "Новий раунд",
      [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      false,
    );

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(txMock.tournamentGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Новий раунд" },
    });
    expect(txMock.tournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
    expect(txMock.tournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: "g1", playerId: "p1" },
        { tournamentGroupId: "g1", playerId: "p2" },
        { tournamentGroupId: "g1", playerId: "p3" },
        { tournamentGroupId: "g1", playerId: "p4" },
      ],
    });
    // Only this group's own matches are deleted - never the rest of the tournament's.
    expect(txMock.match.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1", round: "Гра за 1-3" } });
    expect(txMock.match.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tournamentId: "t1", matchType: "DOUBLES", round: "Новий раунд" })],
    });
  });

  it("skips regenerating matches when fewer than 2 pairs are given", async () => {
    const result = await updateTournamentGroupPairsAction("t1", "g1", "Гра за 1-3", [["p1", "p2"]], false);
    expect(result).toEqual({ success: true, matchCount: 0 });
    expect(txMock.match.createMany).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the group was deleted concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateTournamentGroupPairsAction("t1", "g1", "Плейофф", [], false);
    expect(result.error).toContain("вже видалили");
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
