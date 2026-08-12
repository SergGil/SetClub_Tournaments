import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock, requireDomainAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { findUnique: vi.fn() },
    tournamentParticipant: { findMany: vi.fn() },
    tournamentTeam: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    tournamentTeamMember: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { createTeamAction, deleteTeamAction, updateTeamAction } from "@/lib/actions/teams";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  prismaMock.tournament.findUnique.mockResolvedValue({ format: "MIXED" });
  prismaMock.tournamentParticipant.findMany.mockResolvedValue([
    { playerId: "p1" },
    { playerId: "p2" },
    { playerId: "p3" },
    { playerId: "p4" },
  ]);
});

describe("createTeamAction", () => {
  it("rejects an empty name without touching the database", async () => {
    const result = await createTeamAction("t1", "   ", ["p1", "p2"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("rejects fewer than 2 members", async () => {
    const result = await createTeamAction("t1", "Команда 1", ["p1"]);
    expect(result.error).toContain("від 2 до 4");
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("rejects more than 4 members", async () => {
    prismaMock.tournamentParticipant.findMany.mockResolvedValueOnce(
      ["p1", "p2", "p3", "p4", "p5"].map((playerId) => ({ playerId })),
    );
    const result = await createTeamAction("t1", "Команда 1", ["p1", "p2", "p3", "p4", "p5"]);
    expect(result.error).toContain("від 2 до 4");
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate player id within the same submission", async () => {
    const result = await createTeamAction("t1", "Команда 1", ["p1", "p1"]);
    expect(result.error).toBe("Гравець обраний двічі");
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("rejects a player who isn't a registered participant", async () => {
    const result = await createTeamAction("t1", "Команда 1", ["p1", "ghost"]);
    expect(result.error).toBe("Гравець не зареєстрований у цьому турнірі");
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("blocks team creation for a non-MIXED tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValueOnce({ format: "SINGLES" });
    const result = await createTeamAction("t1", "Команда 1", ["p1", "p2"]);
    expect(result.error).toBe("Команди доступні лише для змішаних турнірів");
    expect(prismaMock.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it("creates the team and its members", async () => {
    const result = await createTeamAction("t1", "Команда 1", ["p1", "p2", "p3"]);

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tournamentId: "t1", name: "Команда 1" }) }),
    );
    const teamId = prismaMock.tournamentTeam.create.mock.calls[0][0].data.id;
    expect(prismaMock.tournamentTeamMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentTeamId: teamId, tournamentId: "t1", playerId: "p1" },
        { tournamentTeamId: teamId, tournamentId: "t1", playerId: "p2" },
        { tournamentTeamId: teamId, tournamentId: "t1", playerId: "p3" },
      ],
    });
  });

  it("reports a player already on another team when the unique constraint fires", async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tournamentId", "playerId"] },
    });
    const result = await createTeamAction("t1", "Команда 1", ["p1", "p2"]);
    expect(result.error).toBe("Гравець уже в іншій команді цього турніру");
  });
});

describe("updateTeamAction", () => {
  it("reports a missing team instead of writing anything", async () => {
    prismaMock.tournamentTeam.findUnique.mockResolvedValueOnce(null);
    const result = await updateTeamAction("t1", "team1", "Команда 1", ["p1", "p2"]);
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTeam.update).not.toHaveBeenCalled();
  });

  it("replaces the member list wholesale", async () => {
    prismaMock.tournamentTeam.findUnique.mockResolvedValueOnce({ tournamentId: "t1" });

    await updateTeamAction("t1", "team1", "Команда 1", ["p3", "p4"]);

    expect(prismaMock.tournamentTeamMember.deleteMany).toHaveBeenCalledWith({
      where: { tournamentTeamId: "team1" },
    });
    expect(prismaMock.tournamentTeamMember.createMany).toHaveBeenCalledWith({
      data: [
        { tournamentTeamId: "team1", tournamentId: "t1", playerId: "p3" },
        { tournamentTeamId: "team1", tournamentId: "t1", playerId: "p4" },
      ],
    });
  });
});

describe("deleteTeamAction", () => {
  it("reports a missing team instead of deleting anything", async () => {
    prismaMock.tournamentTeam.findUnique.mockResolvedValueOnce(null);
    const result = await deleteTeamAction("t1", "team1");
    expect(result.error).toBeDefined();
    expect(prismaMock.tournamentTeam.delete).not.toHaveBeenCalled();
  });

  it("reports a clear error when the team is still part of a tie (FK violation)", async () => {
    prismaMock.tournamentTeam.findUnique.mockResolvedValueOnce({ tournamentId: "t1", name: "Команда 1" });
    prismaMock.tournamentTeam.delete.mockRejectedValueOnce({ code: "P2003" });

    const result = await deleteTeamAction("t1", "team1");

    expect(result.error).toBe("Команда бере участь у зустрічі — спершу видаліть зустріч");
  });

  it("deletes the team", async () => {
    prismaMock.tournamentTeam.findUnique.mockResolvedValueOnce({ tournamentId: "t1", name: "Команда 1" });

    const result = await deleteTeamAction("t1", "team1");

    expect(result.error).toBeUndefined();
    expect(prismaMock.tournamentTeam.delete).toHaveBeenCalledWith({ where: { id: "team1" } });
  });
});
