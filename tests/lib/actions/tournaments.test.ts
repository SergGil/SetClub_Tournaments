import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    tournamentParticipant: { upsert: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    player: { findUnique: vi.fn() },
    $transaction: vi.fn(),
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
vi.mock("@/lib/actions/matches", () => ({
  checkCompletedMatchesAcknowledged: checkCompletedMatchesAcknowledgedMock,
}));

import {
  addParticipantAction,
  createTournamentAction,
  deleteTournamentAction,
  removeParticipantAction,
  setParticipantGroupAction,
  toggleParticipantSeedAction,
  updateTournamentAction,
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
