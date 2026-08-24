import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

// A second, separate mock object for the interactive-transaction callback
// form (`prisma.$transaction(async (tx) => ...)`, used by
// withdrawPadelParticipantAction) - same split as tournaments.test.ts, so
// per-test method mocks on `tx.*` don't collide with the plain
// promise-array transactions the other actions in this file use.
const { prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    padelTournamentParticipant: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    padelTournamentGroup: { update: vi.fn() },
    padelTournamentGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    padelMatch: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    padelMatchPlayer: { deleteMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    padelMatchSet: { deleteMany: vi.fn() },
    padelMatchAdvancement: { count: vi.fn(), findMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return {
    txMock,
    prismaMock: {
      padelTournament: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
      padelTournamentParticipant: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      padelTournamentGroup: {
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      padelTournamentGroupMember: { createMany: vi.fn(), deleteMany: vi.fn() },
      padelMatch: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      padelMatchPlayer: { createMany: vi.fn() },
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
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

const { schedulePadelRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  schedulePadelRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/padel-snapshot", () => ({
  schedulePadelRatingSnapshotRefresh: schedulePadelRatingSnapshotRefreshMock,
}));

const { checkPadelCompletedMatchesAcknowledgedMock } = vi.hoisted(() => ({
  checkPadelCompletedMatchesAcknowledgedMock: vi.fn(),
}));
vi.mock("@/lib/actions/padel-match-randomize-shared", () => ({
  checkPadelCompletedMatchesAcknowledged: checkPadelCompletedMatchesAcknowledgedMock,
}));

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObject: deleteObjectMock }));

import {
  addPadelParticipantAction,
  createPadelTournamentAction,
  createPadelTournamentGroupAction,
  createPadelTournamentGroupWithPairsAction,
  deletePadelTournamentAction,
  deletePadelTournamentGroupAction,
  removePadelParticipantAction,
  resetPadelTournamentAction,
  setPadelParticipantGroupAction,
  togglePadelParticipantSeedAction,
  updatePadelTournamentAction,
  updatePadelTournamentGroupAction,
  updatePadelTournamentGroupPairsAction,
  withdrawPadelParticipantAction,
} from "@/lib/actions/padel-tournaments";

function validFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    name: "Літній кубок",
    description: "",
    format: "SINGLES",
    status: "UPCOMING",
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

describe("createPadelTournamentAction", () => {
  it("returns field errors instead of hitting the database on invalid input", async () => {
    const result = await createPadelTournamentAction({}, validFormData({ name: "" }));
    expect(result.fieldErrors?.name).toBeDefined();
    expect(prismaMock.padelTournament.create).not.toHaveBeenCalled();
  });

  it("creates the tournament, logs the audit entry, and redirects to its detail page", async () => {
    prismaMock.padelTournament.create.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });

    await createPadelTournamentAction({}, validFormData());

    expect(prismaMock.padelTournament.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Літній кубок", createdById: "admin-1" }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.tournament.create", entityId: "t1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/padel/tournaments");
    expect(revalidatePathMock).toHaveBeenCalledWith("/padel/tournaments");
    expect(redirectMock).toHaveBeenCalledWith("/admin/padel/tournaments/t1");
  });
});

describe("updatePadelTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const formData = validFormData();
    formData.delete("id");
    const result = await updatePadelTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("returns an error when the tournament doesn't exist", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce(null);
    const result = await updatePadelTournamentAction({}, validFormData({ id: "t1" }));
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("blocks a format change once matches already exist", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({
      format: "SINGLES",
      _count: { matches: 3 },
    });
    const result = await updatePadelTournamentAction({}, validFormData({ id: "t1", format: "DOUBLES" }));
    expect(result.fieldErrors?.format).toBeDefined();
    expect(prismaMock.padelTournament.update).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament was deleted concurrently", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", _count: { matches: 0 } });
    prismaMock.padelTournament.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updatePadelTournamentAction({}, validFormData({ id: "t1" }));
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
  });

  it("updates the tournament and refreshes ratings on success", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", _count: { matches: 0 } });
    prismaMock.padelTournament.update.mockResolvedValueOnce({});

    const result = await updatePadelTournamentAction({}, validFormData({ id: "t1" }));

    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.tournament.update", entityId: "t1" }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
  });
});

describe("deletePadelTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deletePadelTournamentAction({}, new FormData());
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("blocks deletion when completed matches aren't acknowledged, without touching the DB", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce("У турнірі є 2 завершених матчів...");
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await deletePadelTournamentAction({}, formData);
    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.padelTournament.delete).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament was already deleted", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await deletePadelTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
  });

  it("deletes the tournament, logs it, and redirects to the list", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ photos: [] });
    prismaMock.padelTournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    const formData = new FormData();
    formData.set("id", "t1");

    await deletePadelTournamentAction({}, formData);

    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.tournament.delete", summary: expect.stringContaining("Літній кубок") }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/admin/padel/tournaments");
  });

  // Regression test: PadelPhoto rows cascade-delete at the DB level the
  // moment the PadelTournament row is deleted, which would silently orphan
  // their R2 objects forever if nothing read the keys first.
  it("cleans up every photo's R2 object after deleting a tournament that had photos", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({
      photos: [{ key: "padel-tournaments/t1/a.jpg" }, { key: "padel-tournaments/t1/b.jpg" }],
    });
    prismaMock.padelTournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    const formData = new FormData();
    formData.set("id", "t1");

    await deletePadelTournamentAction({}, formData);

    expect(deleteObjectMock).toHaveBeenCalledWith("padel-tournaments/t1/a.jpg");
    expect(deleteObjectMock).toHaveBeenCalledWith("padel-tournaments/t1/b.jpg");
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
  });

  it("still deletes and redirects even if an R2 cleanup call fails", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({
      photos: [{ key: "padel-tournaments/t1/a.jpg" }],
    });
    prismaMock.padelTournament.delete.mockResolvedValueOnce({ id: "t1", name: "Літній кубок" });
    deleteObjectMock.mockRejectedValueOnce(new Error("network error"));
    const formData = new FormData();
    formData.set("id", "t1");

    await deletePadelTournamentAction({}, formData);

    expect(redirectMock).toHaveBeenCalledWith("/admin/padel/tournaments");
  });
});

describe("resetPadelTournamentAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await resetPadelTournamentAction({}, new FormData());
    expect(result.error).toBe("Турнір не знайдено");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks reset when completed matches aren't acknowledged, without touching the DB", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce("У турнірі є 2 завершених матчів...");
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await resetPadelTournamentAction({}, formData);
    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament doesn't exist", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce(null);
    const formData = new FormData();
    formData.set("id", "t1");
    const result = await resetPadelTournamentAction({}, formData);
    expect(result.error).toBe("Турнір не знайдено — можливо, його вже видалили");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deletes matches and custom groups, clears the built-in group field, and keeps participants/seed", async () => {
    checkPadelCompletedMatchesAcknowledgedMock.mockResolvedValueOnce(null);
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ name: "Літній кубок" });
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 3 }, { count: 1 }, { count: 5 }]);
    const formData = new FormData();
    formData.set("id", "t1");

    const result = await resetPadelTournamentAction({}, formData);

    expect(result).toEqual({ success: true });
    expect(prismaMock.padelMatch.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(prismaMock.padelTournamentGroup.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1" } });
    expect(prismaMock.padelTournamentParticipant.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      data: { group: null },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.tournament.reset", summary: expect.stringContaining("Літній кубок") }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("addPadelParticipantAction", () => {
  it("returns an error for an empty selection without touching the DB", async () => {
    const result = await addPadelParticipantAction("t1", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("upserts every selected player and refreshes ratings", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const result = await addPadelParticipantAction("t1", ["p1", "p2"]);

    expect(result).toEqual({});
    expect(prismaMock.padelTournamentParticipant.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.padelTournamentParticipant.upsert).toHaveBeenCalledWith({
      where: { tournamentId_playerId: { tournamentId: "t1", playerId: "p1" } },
      update: {},
      create: { tournamentId: "t1", playerId: "p1" },
    });
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("returns a friendly error when the tournament or a player was removed concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2003" });

    const result = await addPadelParticipantAction("t1", ["p1"]);

    expect(result.error).toBe("Турнір або гравець не знайдено — можливо, їх вже видалили");
  });
});

describe("removePadelParticipantAction", () => {
  it("refuses to remove a participant who already has matches", async () => {
    prismaMock.padelTournamentParticipant.deleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await removePadelParticipantAction("t1", "p1");
    expect(result.error).toContain("уже має матчі");
  });

  it("removes the participant and logs their name when found", async () => {
    prismaMock.padelTournamentParticipant.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.player.findUnique.mockResolvedValueOnce({ name: "Іван" });

    const result = await removePadelParticipantAction("t1", "p1");

    expect(result).toEqual({});
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Іван") }),
    );
  });
});

describe("withdrawPadelParticipantAction", () => {
  function withdrawFormData(overrides: Record<string, string> = {}) {
    const formData = new FormData();
    formData.set("tournamentId", "t1");
    formData.set("playerId", "p1");
    for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
    return formData;
  }

  beforeEach(() => {
    prismaMock.padelTournament.findUnique.mockResolvedValue({ format: "SINGLES" });
    prismaMock.padelTournamentParticipant.findUnique.mockResolvedValue({
      withdrawnAt: null,
      player: { name: "Іван" },
    });
    txMock.padelMatchAdvancement.count.mockResolvedValue(0);
    txMock.padelTournamentParticipant.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns an error when the tournament or player id is missing", async () => {
    const result = await withdrawPadelParticipantAction({}, new FormData());
    expect(result.error).toBe("Турнір або гравця не знайдено");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks withdrawal for a DOUBLES tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "DOUBLES" });
    const result = await withdrawPadelParticipantAction({}, withdrawFormData());
    expect(result.error).toContain("парних турнірів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the tournament doesn't exist", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce(null);
    const result = await withdrawPadelParticipantAction({}, withdrawFormData());
    expect(result.error).toBe("Турнір не знайдено");
  });

  it("returns an error when the participant doesn't exist", async () => {
    prismaMock.padelTournamentParticipant.findUnique.mockResolvedValueOnce(null);
    const result = await withdrawPadelParticipantAction({}, withdrawFormData());
    expect(result.error).toContain("Учасника не знайдено");
  });

  it("returns an error when the participant is already withdrawn", async () => {
    prismaMock.padelTournamentParticipant.findUnique.mockResolvedValueOnce({
      withdrawnAt: new Date("2026-01-01"),
      player: { name: "Іван" },
    });
    const result = await withdrawPadelParticipantAction({}, withdrawFormData());
    expect(result.error).toBe("Гравця вже знято з турніру");
  });

  it("reports 'already withdrawn' instead of double-closing matches when a concurrent submit wins the advisory lock race", async () => {
    txMock.padelTournamentParticipant.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await withdrawPadelParticipantAction({}, withdrawFormData());

    expect(result.error).toBe("Гравця вже знято з турніру");
    expect(txMock.padelMatch.findMany).not.toHaveBeenCalled();
    expect(txMock.padelMatch.update).not.toHaveBeenCalled();
  });

  it("marks the participant withdrawn and closes their SCHEDULED matches as walkovers for the opponent", async () => {
    txMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }],
      },
    ]);

    const result = await withdrawPadelParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.$executeRaw).toHaveBeenCalled();
    expect(txMock.padelTournamentParticipant.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1", playerId: "p1", withdrawnAt: null },
      data: { withdrawnAt: expect.any(Date) },
    });
    expect(txMock.padelMatch.update).toHaveBeenCalledWith({
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
        action: "padel.tournament.participant.withdraw",
        summary: expect.stringContaining("Іван"),
      }),
    );
    expect(updateTagMock).toHaveBeenCalled();
    expect(schedulePadelRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("vacates an unpaired slot instead of awarding a walkover when the opponent side is still empty", async () => {
    txMock.padelMatch.findMany.mockResolvedValueOnce([
      { id: "m1", players: [{ side: "A", playerId: "p1" }] },
    ]);

    const result = await withdrawPadelParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatchPlayer.deleteMany).toHaveBeenCalledWith({
      where: { matchId: "m1", playerId: "p1" },
    });
    expect(txMock.padelMatch.update).not.toHaveBeenCalled();
  });

  it("only ever queries SCHEDULED matches for closing, leaving real COMPLETED results alone", async () => {
    txMock.padelMatch.findMany.mockResolvedValueOnce([]);

    const result = await withdrawPadelParticipantAction({}, withdrawFormData());

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SCHEDULED", tournamentId: "t1" }),
      }),
    );
    expect(txMock.padelMatch.update).not.toHaveBeenCalled();
  });

  it("returns cascadeResets and requires confirmation before resetting an already-COMPLETED downstream match", async () => {
    txMock.padelMatchAdvancement.count.mockResolvedValue(1);
    txMock.padelMatch.findMany
      .mockResolvedValueOnce([
        { id: "m1", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      ])
      .mockResolvedValueOnce([
        { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "B", walkover: true, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
        { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", walkover: false, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
      ]);
    txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, withdrawnAt: new Date("2026-01-01"), player: { name: "Іван" } },
      { playerId: "p2", group: null, withdrawnAt: null, player: { name: "Петро" } },
      { playerId: "p3", group: null, withdrawnAt: null, player: { name: "Олег" } },
    ]);

    const result = await withdrawPadelParticipantAction({}, withdrawFormData());

    expect(result.error).toContain("скине рахунок");
    expect(result.cascadeResets).toEqual([
      { matchId: "final", round: "Фінал", sideALabel: "Іван", sideBLabel: "Олег" },
    ]);
    expect(txMock.padelMatchPlayer.deleteMany).not.toHaveBeenCalled();
  });

  it("applies the fill and reset once acknowledgedCascadeReset is confirmed", async () => {
    txMock.padelMatchAdvancement.count.mockResolvedValue(1);
    txMock.padelMatch.findMany
      .mockResolvedValueOnce([
        { id: "m1", players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }] },
      ])
      .mockResolvedValueOnce([
        { id: "m1", round: "1/2", status: "COMPLETED", winnerSide: "B", walkover: true, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p2" }], sets: [] },
        { id: "final", round: "Фінал", status: "COMPLETED", winnerSide: "A", walkover: false, players: [{ side: "A", playerId: "p1" }, { side: "B", playerId: "p3" }], sets: [] },
      ]);
    txMock.padelMatchAdvancement.findMany.mockResolvedValueOnce([
      { matchId: "final", side: "A", source: "MATCH_RESULT", sourceGroup: null, sourceRank: null, sourceMatchId: "m1", outcome: "WINNER" },
    ]);
    txMock.padelTournamentParticipant.findMany.mockResolvedValueOnce([
      { playerId: "p1", group: null, withdrawnAt: new Date("2026-01-01"), player: { name: "Іван" } },
      { playerId: "p2", group: null, withdrawnAt: null, player: { name: "Петро" } },
      { playerId: "p3", group: null, withdrawnAt: null, player: { name: "Олег" } },
    ]);

    const result = await withdrawPadelParticipantAction({}, withdrawFormData({ acknowledgedCascadeReset: "true" }));

    expect(result).toEqual({ success: true });
    expect(txMock.padelMatchPlayer.deleteMany).toHaveBeenCalledWith({ where: { matchId: "final", side: "A" } });
    expect(txMock.padelMatchPlayer.create).toHaveBeenCalledWith({
      data: { matchId: "final", side: "A", playerId: "p2" },
    });
    expect(txMock.padelMatchSet.deleteMany).toHaveBeenCalledWith({ where: { matchId: { in: ["final"] } } });
    expect(txMock.padelMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["final"] } },
      data: { status: "SCHEDULED", winnerSide: null, completedAt: null, retired: false },
    });
    expect(txMock.padelMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" } }),
    );
  });
});

describe("togglePadelParticipantSeedAction", () => {
  it("no-ops silently if the participant was removed concurrently", async () => {
    prismaMock.padelTournamentParticipant.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(togglePadelParticipantSeedAction("t1", "p1", true)).resolves.toBeUndefined();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("re-throws unexpected errors", async () => {
    prismaMock.padelTournamentParticipant.update.mockRejectedValueOnce(new Error("boom"));
    await expect(togglePadelParticipantSeedAction("t1", "p1", true)).rejects.toThrow("boom");
  });

  it("sets seed=1 when seeding and seed=null when unseeding", async () => {
    prismaMock.padelTournamentParticipant.update.mockResolvedValueOnce({ player: { name: "Іван" } });
    await togglePadelParticipantSeedAction("t1", "p1", true);
    expect(prismaMock.padelTournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { seed: 1 } }),
    );

    prismaMock.padelTournamentParticipant.update.mockResolvedValueOnce({ player: { name: "Іван" } });
    await togglePadelParticipantSeedAction("t1", "p1", false);
    expect(prismaMock.padelTournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { seed: null } }),
    );
  });
});

describe("setPadelParticipantGroupAction", () => {
  it.each([0, 7, 1.5])("rejects an out-of-range group number (%s)", async (group) => {
    const result = await setPadelParticipantGroupAction("t1", "p1", group);
    expect(result?.error).toBeDefined();
    expect(prismaMock.padelTournamentParticipant.update).not.toHaveBeenCalled();
  });

  it("allows clearing the group with null", async () => {
    prismaMock.padelTournamentParticipant.update.mockResolvedValueOnce({});
    const result = await setPadelParticipantGroupAction("t1", "p1", null);
    expect(result).toBeUndefined();
    expect(prismaMock.padelTournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { group: null } }),
    );
  });

  it("no-ops silently if the participant was removed concurrently", async () => {
    prismaMock.padelTournamentParticipant.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(setPadelParticipantGroupAction("t1", "p1", 2)).resolves.toBeUndefined();
  });
});

describe("createPadelTournamentGroupAction", () => {
  beforeEach(() => {
    prismaMock.padelTournamentParticipant.aggregate.mockResolvedValue({ _max: { group: null } });
    prismaMock.padelTournamentGroup.aggregate.mockResolvedValue({ _max: { number: null } });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await createPadelTournamentGroupAction("t1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't registered in the tournament", async () => {
    const result = await createPadelTournamentGroupAction("t1", "Плейофф", ["ghost"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group and does not touch TournamentParticipant.group at all", async () => {
    const result = await createPadelTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);

    expect(result.error).toBeUndefined();
    expect(prismaMock.padelTournamentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tournamentId: "t1", name: "Плейофф" }) }),
    );
    expect(prismaMock.padelTournamentParticipant.update).not.toHaveBeenCalled();
    expect(prismaMock.padelTournamentParticipant.updateMany).not.toHaveBeenCalled();
  });

  it("adds every picked player as a group member of the new group", async () => {
    await createPadelTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);

    const groupCreateCall = prismaMock.padelTournamentGroup.create.mock.calls[0][0];
    const newGroupId = groupCreateCall.data.id;
    expect(prismaMock.padelTournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: newGroupId, playerId: "p1" },
        { tournamentGroupId: newGroupId, playerId: "p2" },
      ],
    });
  });

  it("skips the membership write entirely when no players are picked", async () => {
    await createPadelTournamentGroupAction("t1", "Плейофф", []);
    expect(prismaMock.padelTournamentGroupMember.createMany).not.toHaveBeenCalled();
  });

  it("picks the next group number past both the built-in range and any existing custom group", async () => {
    prismaMock.padelTournamentParticipant.aggregate.mockResolvedValueOnce({ _max: { group: 3 } });
    prismaMock.padelTournamentGroup.aggregate.mockResolvedValueOnce({ _max: { number: 9 } });

    await createPadelTournamentGroupAction("t1", "Плейофф", []);

    expect(prismaMock.padelTournamentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 10 }) }),
    );
  });

  it("reports a retryable number race distinctly from a duplicate member on a P2002", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentId", "number"] },
    });
    const result = await createPadelTournamentGroupAction("t1", "Плейофф", []);
    expect(result.error).toContain("спробуйте ще раз");
  });

  it("reports a duplicate picked player distinctly from a group-number race on a P2002", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentGroupId", "playerId"] },
    });
    const result = await createPadelTournamentGroupAction("t1", "Плейофф", ["p1", "p2"]);
    expect(result.error).toBe("Один із гравців обраний двічі");
  });
});

describe("createPadelTournamentGroupWithPairsAction", () => {
  beforeEach(() => {
    prismaMock.padelTournamentParticipant.aggregate.mockResolvedValue({ _max: { group: null } });
    prismaMock.padelTournamentGroup.aggregate.mockResolvedValue({ _max: { number: null } });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    prismaMock.padelTournament.findUnique.mockResolvedValue({ format: "DOUBLES", startDate: new Date("2026-01-01") });
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await createPadelTournamentGroupWithPairsAction("t1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: null });
    const result = await createPadelTournamentGroupWithPairsAction("t1", "Плейофф", [["p1", "p2"]]);
    expect(result.error).toContain("парного турніру");
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a pair with a player outside the roster", async () => {
    const result = await createPadelTournamentGroupWithPairsAction("t1", "Плейофф", [["p1", "ghost"]]);
    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a player used in two pairs at once", async () => {
    const result = await createPadelTournamentGroupWithPairsAction("t1", "Плейофф", [
      ["p1", "p2"],
      ["p1", "p3"],
    ]);
    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group, its membership from the flattened pairs, and the full round robin", async () => {
    const result = await createPadelTournamentGroupWithPairsAction("t1", "Гра за 1-3", [
      ["p1", "p2"],
      ["p3", "p4"],
    ]);

    expect(result).toEqual({ success: true, matchCount: 1 });
    const groupCreateCall = prismaMock.padelTournamentGroup.create.mock.calls[0][0];
    const newGroupId = groupCreateCall.data.id;
    expect(prismaMock.padelTournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: newGroupId, playerId: "p1" },
        { tournamentGroupId: newGroupId, playerId: "p2" },
        { tournamentGroupId: newGroupId, playerId: "p3" },
        { tournamentGroupId: newGroupId, playerId: "p4" },
      ],
    });
    expect(prismaMock.padelMatch.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tournamentId: "t1", matchType: "DOUBLES", round: "Гра за 1-3" })],
    });
    expect(prismaMock.padelMatchPlayer.createMany).toHaveBeenCalled();
  });

  it("creates the group with no matches when fewer than 2 pairs are given", async () => {
    const result = await createPadelTournamentGroupWithPairsAction("t1", "Гра за 1-3", [["p1", "p2"]]);
    expect(result).toEqual({ success: true, matchCount: 0 });
    expect(prismaMock.padelMatch.createMany).not.toHaveBeenCalled();
  });
});

describe("updatePadelTournamentGroupAction", () => {
  beforeEach(() => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValue({ tournamentId: "t1", name: "Плейофф" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([{ playerId: "p1" }, { playerId: "p2" }]);
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await updatePadelTournamentGroupAction("t1", "g1", "   ", []);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects without updating when the group doesn't exist", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce(null);

    const result = await updatePadelTournamentGroupAction("t1", "ghost", "Плейофф", []);

    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects without updating when the group belongs to a different tournament", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "other-tournament" });

    const result = await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", []);

    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't registered in the tournament", async () => {
    const result = await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", ["ghost"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("renames the group and replaces its membership wholesale, without touching its number", async () => {
    const result = await updatePadelTournamentGroupAction("t1", "g1", "Новий Плейофф", ["p1", "p2"]);

    expect(result.error).toBeUndefined();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.padelTournamentGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Новий Плейофф" },
    });
    expect(prismaMock.padelTournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
    expect(prismaMock.padelTournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: "g1", playerId: "p1" },
        { tournamentGroupId: "g1", playerId: "p2" },
      ],
    });
    // The group's existing matches are tagged by round === its OLD name -
    // a rename must carry them over too, so they stay part of the group.
    expect(prismaMock.padelMatch.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1", round: "Плейофф" },
      data: { round: "Новий Плейофф" },
    });
  });

  it("skips the membership write entirely when no players are picked", async () => {
    await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", []);
    expect(prismaMock.padelTournamentGroupMember.createMany).not.toHaveBeenCalled();
    expect(prismaMock.padelTournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
  });

  it("does not touch matches when the name doesn't actually change", async () => {
    await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", ["p1", "p2"]);
    expect(prismaMock.padelMatch.updateMany).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the group was deleted concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2025" });

    const result = await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", []);

    expect(result.error).toContain("вже видалили");
  });

  it("reports a friendly error when playerIds contains a duplicate", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentGroupId", "playerId"] },
    });

    const result = await updatePadelTournamentGroupAction("t1", "g1", "Плейофф", ["p1", "p1"]);

    expect(result.error).toBe("Один із гравців обраний двічі");
  });
});

describe("updatePadelTournamentGroupPairsAction", () => {
  beforeEach(() => {
    prismaMock.padelTournament.findUnique.mockResolvedValue({ format: "DOUBLES", startDate: new Date("2026-01-01") });
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValue({ tournamentId: "t1", name: "Гра за 1-3" });
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" },
      { playerId: "p3" },
      { playerId: "p4" },
    ]);
    prismaMock.padelMatch.count.mockResolvedValue(0);
    // No existing matches for this group by default - tests that care about
    // the pure-rename fast path override this to make submitted pairs match.
    prismaMock.padelMatch.findMany.mockResolvedValue([]);
  });

  it("rejects an empty name without updating", async () => {
    const result = await updatePadelTournamentGroupPairsAction("t1", "g1", "   ", [], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-doubles tournament", async () => {
    prismaMock.padelTournament.findUnique.mockResolvedValueOnce({ format: "SINGLES", startDate: null });
    const result = await updatePadelTournamentGroupPairsAction("t1", "g1", "Плейофф", [], false);
    expect(result.error).toContain("парного турніру");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the group doesn't exist", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce(null);
    const result = await updatePadelTournamentGroupPairsAction("t1", "ghost", "Плейофф", [], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a pair with a player outside the roster", async () => {
    const result = await updatePadelTournamentGroupPairsAction("t1", "g1", "Плейофф", [["p1", "ghost"]], false);
    expect(result.error).toBeDefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("renames the group without touching its matches when the submitted pairs match its current teams", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
    ]);

    const result = await updatePadelTournamentGroupPairsAction(
      "t1",
      "g1",
      "Гра за 1-3 місце",
      [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      false,
    );

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(prismaMock.padelTournamentGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Гра за 1-3 місце" },
    });
    expect(prismaMock.padelMatch.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1", round: "Гра за 1-3" },
      data: { round: "Гра за 1-3 місце" },
    });
    // No completed-match check, no membership/match rebuild - this is a pure rename.
    expect(prismaMock.padelMatch.count).not.toHaveBeenCalled();
    expect(prismaMock.padelMatch.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.padelMatch.createMany).not.toHaveBeenCalled();
    expect(prismaMock.padelTournamentGroupMember.deleteMany).not.toHaveBeenCalled();
  });

  it("does not touch matches at all when neither the name nor the pairs change", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
    ]);

    const result = await updatePadelTournamentGroupPairsAction(
      "t1",
      "g1",
      "Гра за 1-3",
      [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      false,
    );

    expect(result).toEqual({ success: true, matchCount: 1 });
    expect(prismaMock.padelMatch.updateMany).not.toHaveBeenCalled();
  });

  it("still requires the completed-match confirmation once the pairs actually change, even with the same name", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      {
        players: [
          { side: "A", playerId: "p1" },
          { side: "A", playerId: "p2" },
          { side: "B", playerId: "p3" },
          { side: "B", playerId: "p4" },
        ],
      },
    ]);
    prismaMock.padelMatch.count.mockResolvedValueOnce(2);

    const result = await updatePadelTournamentGroupPairsAction(
      "t1",
      "g1",
      "Гра за 1-3",
      [
        ["p1", "p3"],
        ["p2", "p4"],
      ],
      false,
    );

    expect(result.error).toContain("завершених матчів");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks the update when the group's own matches include a completed one, unless acknowledged", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(2);
    const result = await updatePadelTournamentGroupPairsAction(
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
    prismaMock.padelMatch.count.mockResolvedValueOnce(2);
    const result = await updatePadelTournamentGroupPairsAction(
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
    const result = await updatePadelTournamentGroupPairsAction(
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
    expect(txMock.padelTournamentGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { name: "Новий раунд" },
    });
    expect(txMock.padelTournamentGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentGroupId: "g1" },
    });
    expect(txMock.padelTournamentGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentGroupId: "g1", playerId: "p1" },
        { tournamentGroupId: "g1", playerId: "p2" },
        { tournamentGroupId: "g1", playerId: "p3" },
        { tournamentGroupId: "g1", playerId: "p4" },
      ],
    });
    expect(txMock.padelMatch.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t1", round: "Гра за 1-3" } });
    expect(txMock.padelMatch.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tournamentId: "t1", matchType: "DOUBLES", round: "Новий раунд" })],
    });
  });

  it("skips regenerating matches when fewer than 2 pairs are given", async () => {
    const result = await updatePadelTournamentGroupPairsAction("t1", "g1", "Гра за 1-3", [["p1", "p2"]], false);
    expect(result).toEqual({ success: true, matchCount: 0 });
    expect(txMock.padelMatch.createMany).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the group was deleted concurrently", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: "P2025" });
    const result = await updatePadelTournamentGroupPairsAction("t1", "g1", "Плейофф", [], false);
    expect(result.error).toContain("вже видалили");
  });
});

describe("deletePadelTournamentGroupAction", () => {
  it("deletes the group when it belongs to the given tournament", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "t1", name: "Плейофф" });

    const result = await deletePadelTournamentGroupAction("t1", "g1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.padelTournamentGroup.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });

  it("rejects without deleting when the group doesn't exist", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce(null);

    const result = await deletePadelTournamentGroupAction("t1", "ghost");

    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.delete).not.toHaveBeenCalled();
  });

  it("rejects without deleting when the group belongs to a different tournament", async () => {
    prismaMock.padelTournamentGroup.findUnique.mockResolvedValueOnce({ tournamentId: "other-tournament", name: "Х" });

    const result = await deletePadelTournamentGroupAction("t1", "g1");

    expect(result.error).toBeDefined();
    expect(prismaMock.padelTournamentGroup.delete).not.toHaveBeenCalled();
  });
});
