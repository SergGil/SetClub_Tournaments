import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournamentTeam: { findMany: vi.fn() },
    tournamentTie: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    match: { create: vi.fn() },
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

const { scheduleRatingSnapshotRefreshMock } = vi.hoisted(() => ({
  scheduleRatingSnapshotRefreshMock: vi.fn(),
}));
vi.mock("@/lib/rating/snapshot", () => ({ scheduleRatingSnapshotRefresh: scheduleRatingSnapshotRefreshMock }));

import { createRubberAction, createTieAction, deleteTieAction } from "@/lib/actions/ties";
import type { ActionState } from "@/lib/actions/matches";

const initialState: ActionState = {};

function rubberFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    tieId: "tie1",
    matchType: "SINGLES",
    scheduledDate: "",
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

describe("createTieAction", () => {
  it("rejects picking the same team twice", async () => {
    const result = await createTieAction("t1", "teamA", "teamA");
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTie.create).not.toHaveBeenCalled();
  });

  it("rejects a team that doesn't belong to this tournament", async () => {
    prismaMock.tournamentTeam.findMany.mockResolvedValueOnce([{ id: "teamA" }]);
    const result = await createTieAction("t1", "teamA", "teamB");
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTie.create).not.toHaveBeenCalled();
  });

  it("creates the tie with an optional label", async () => {
    prismaMock.tournamentTeam.findMany.mockResolvedValueOnce([{ id: "teamA" }, { id: "teamB" }]);
    prismaMock.tournamentTie.create.mockResolvedValueOnce({ id: "tie1" });

    const result = await createTieAction("t1", "teamA", "teamB", "Тур 1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentTie.create).toHaveBeenCalledWith({
      data: { tournamentId: "t1", teamAId: "teamA", teamBId: "teamB", label: "Тур 1" },
    });
  });

  it("stores no label at all when left blank", async () => {
    prismaMock.tournamentTeam.findMany.mockResolvedValueOnce([{ id: "teamA" }, { id: "teamB" }]);
    prismaMock.tournamentTie.create.mockResolvedValueOnce({ id: "tie1" });

    await createTieAction("t1", "teamA", "teamB");

    expect(prismaMock.tournamentTie.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ label: null }) }),
    );
  });
});

describe("deleteTieAction", () => {
  it("reports a missing tie instead of deleting anything", async () => {
    prismaMock.tournamentTie.findUnique.mockResolvedValueOnce(null);
    const result = await deleteTieAction("t1", "tie1");
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTie.delete).not.toHaveBeenCalled();
  });

  it("deletes the tie - rubbers survive via the schema's own SetNull FK, no extra cleanup needed here", async () => {
    prismaMock.tournamentTie.findUnique.mockResolvedValueOnce({ tournamentId: "t1", label: "Тур 1" });

    const result = await deleteTieAction("t1", "tie1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentTie.delete).toHaveBeenCalledWith({ where: { id: "tie1" } });
  });
});

describe("createRubberAction", () => {
  function mockTie(teamAIds: string[], teamBIds: string[]) {
    prismaMock.tournamentTie.findUnique.mockResolvedValueOnce({
      tournamentId: "t1",
      teamA: { members: teamAIds.map((playerId) => ({ playerId })) },
      teamB: { members: teamBIds.map((playerId) => ({ playerId })) },
    });
  }

  it("reports a missing tie instead of creating a match", async () => {
    prismaMock.tournamentTie.findUnique.mockResolvedValueOnce(null);
    const result = await createRubberAction(initialState, rubberFormData({ sideAPlayerIds: "p1", sideBPlayerIds: "p2" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("rejects a side-A player who isn't a member of team A, even if they're a real tournament participant", async () => {
    mockTie(["a1", "a2"], ["b1", "b2"]);
    const formData = rubberFormData();
    formData.set("sideAPlayerIds", "b1"); // a real player, but on the wrong team
    formData.set("sideBPlayerIds", "b2");

    const result = await createRubberAction(initialState, formData);

    expect(result.error).toBe("Гравець сторони А має бути учасником команди А цієї зустрічі");
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("rejects a side-B player who isn't a member of team B", async () => {
    mockTie(["a1", "a2"], ["b1", "b2"]);
    const formData = rubberFormData();
    formData.set("sideAPlayerIds", "a1");
    formData.set("sideBPlayerIds", "a2");

    const result = await createRubberAction(initialState, formData);

    expect(result.error).toBe("Гравець сторони Б має бути учасником команди Б цієї зустрічі");
    expect(prismaMock.match.create).not.toHaveBeenCalled();
  });

  it("creates a singles rubber tagged with the tie's id", async () => {
    mockTie(["a1", "a2"], ["b1", "b2"]);
    prismaMock.match.create.mockResolvedValueOnce({ id: "m1" });
    const formData = rubberFormData();
    formData.set("sideAPlayerIds", "a1");
    formData.set("sideBPlayerIds", "b1");

    const result = await createRubberAction(initialState, formData);

    expect(result.success).toBe(true);
    expect(prismaMock.match.create).toHaveBeenCalledWith({
      data: {
        tournamentId: "t1",
        tieId: "tie1",
        matchType: "SINGLES",
        scheduledDate: null,
        players: { create: [{ side: "A", playerId: "a1" }, { side: "B", playerId: "b1" }] },
      },
    });
    expect(scheduleRatingSnapshotRefreshMock).toHaveBeenCalled();
  });

  it("creates a doubles rubber with two players per side", async () => {
    mockTie(["a1", "a2"], ["b1", "b2"]);
    prismaMock.match.create.mockResolvedValueOnce({ id: "m1" });
    const formData = new FormData();
    formData.set("tieId", "tie1");
    formData.set("matchType", "DOUBLES");
    formData.set("scheduledDate", "");
    formData.append("sideAPlayerIds", "a1");
    formData.append("sideAPlayerIds", "a2");
    formData.append("sideBPlayerIds", "b1");
    formData.append("sideBPlayerIds", "b2");

    const result = await createRubberAction(initialState, formData);

    expect(result.success).toBe(true);
    expect(prismaMock.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          players: {
            create: [
              { side: "A", playerId: "a1" },
              { side: "A", playerId: "a2" },
              { side: "B", playerId: "b1" },
              { side: "B", playerId: "b2" },
            ],
          },
        }),
      }),
    );
  });
});
