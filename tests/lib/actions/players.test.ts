import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    player: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import {
  createPlayerAction,
  deletePlayerAction,
  linkPlayerAction,
  unlinkPlayerAction,
  updatePlayerAction,
} from "@/lib/actions/players";

function playerFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    name: "Іван Петренко",
    email: "",
    gender: "",
    nickname: "",
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

describe("createPlayerAction", () => {
  it("returns field errors for an invalid name, without touching the DB", async () => {
    const result = await createPlayerAction({}, playerFormData({ name: "" }));
    expect(result.fieldErrors?.name).toBeDefined();
    expect(prismaMock.player.create).not.toHaveBeenCalled();
  });

  it("reports a duplicate email as a field error", async () => {
    prismaMock.player.create.mockRejectedValueOnce({ code: "P2002" });
    const result = await createPlayerAction({}, playerFormData({ email: "dup@test.com" }));
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it("creates the player and logs it on success", async () => {
    prismaMock.player.create.mockResolvedValueOnce({ id: "p1", name: "Іван Петренко" });
    const result = await createPlayerAction({}, playerFormData());
    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "player.create" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/players");
  });

  it("passes the nickname through to prisma, normalized to null when blank", async () => {
    prismaMock.player.create.mockResolvedValueOnce({ id: "p1", name: "Данилюк Євген" });
    await createPlayerAction({}, playerFormData({ name: "Данилюк Євген", nickname: "Женя" }));
    expect(prismaMock.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nickname: "Женя" }),
    });

    prismaMock.player.create.mockResolvedValueOnce({ id: "p2", name: "Іван Петренко" });
    await createPlayerAction({}, playerFormData());
    expect(prismaMock.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nickname: null }),
    });
  });
});

describe("updatePlayerAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await updatePlayerAction({}, playerFormData());
    expect(result.error).toBe("Гравця не знайдено");
  });

  it("reports a duplicate email as a field error", async () => {
    prismaMock.player.update.mockRejectedValueOnce({ code: "P2002" });
    const result = await updatePlayerAction({}, playerFormData({ id: "p1", email: "dup@test.com" }));
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it("returns an error when the player was deleted concurrently", async () => {
    prismaMock.player.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updatePlayerAction({}, playerFormData({ id: "p1" }));
    expect(result.error).toContain("вже видалили");
  });

  it("updates the player on success", async () => {
    prismaMock.player.update.mockResolvedValueOnce({});
    const result = await updatePlayerAction({}, playerFormData({ id: "p1" }));
    expect(result).toEqual({ success: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/players/p1");
  });
});

describe("deletePlayerAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deletePlayerAction({}, new FormData());
    expect(result.error).toBe("Гравця не знайдено");
  });

  it("refuses to delete a player with match/tournament history", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce({ name: "Іван" });
    prismaMock.player.deleteMany.mockResolvedValueOnce({ count: 0 });
    const formData = new FormData();
    formData.set("id", "p1");
    const result = await deletePlayerAction({}, formData);
    expect(result.error).toContain("історію матчів");
  });

  it("reports plain not-found when the player never existed", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce(null);
    prismaMock.player.deleteMany.mockResolvedValueOnce({ count: 0 });
    const formData = new FormData();
    formData.set("id", "p1");
    const result = await deletePlayerAction({}, formData);
    expect(result.error).toBe("Гравця не знайдено");
  });

  it("deletes a player with no history and logs it", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce({ name: "Іван" });
    prismaMock.player.deleteMany.mockResolvedValueOnce({ count: 1 });
    const formData = new FormData();
    formData.set("id", "p1");
    const result = await deletePlayerAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Іван") }),
    );
  });
});

describe("unlinkPlayerAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await unlinkPlayerAction({}, new FormData());
    expect(result.error).toBe("Гравця не знайдено");
  });

  it("returns an error when the player was deleted concurrently", async () => {
    prismaMock.player.update.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "p1");
    const result = await unlinkPlayerAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("clears the linked account and logs it", async () => {
    prismaMock.player.update.mockResolvedValueOnce({ name: "Іван" });
    const formData = new FormData();
    formData.set("id", "p1");
    const result = await unlinkPlayerAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(prismaMock.player.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { userId: null } });
  });
});

describe("linkPlayerAction", () => {
  it("returns an error when no user is selected", async () => {
    const formData = new FormData();
    formData.set("playerId", "p1");
    const result = await linkPlayerAction({}, formData);
    expect(result.error).toBe("Оберіть користувача");
  });

  it("reports an email conflict distinctly from a user already linked elsewhere", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce({ email: null });
    prismaMock.user.findUnique.mockResolvedValueOnce({ email: "taken@test.com" });
    prismaMock.player.update.mockRejectedValueOnce({ code: "P2002", meta: { target: ["email"] } });
    const formData = new FormData();
    formData.set("playerId", "p1");
    formData.set("userId", "u1");
    const result = await linkPlayerAction({}, formData);
    expect(result.error).toContain("Email");
  });

  it("reports a user already linked to another player", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce({ email: null });
    prismaMock.user.findUnique.mockResolvedValueOnce({ email: "u@test.com" });
    prismaMock.player.update.mockRejectedValueOnce({ code: "P2002", meta: { target: ["userId"] } });
    const formData = new FormData();
    formData.set("playerId", "p1");
    formData.set("userId", "u1");
    const result = await linkPlayerAction({}, formData);
    expect(result.error).toContain("уже прив'язаний");
  });

  it("links the account and logs it on success", async () => {
    prismaMock.player.findUnique.mockResolvedValueOnce({ email: null });
    prismaMock.user.findUnique.mockResolvedValueOnce({ email: "u@test.com" });
    prismaMock.player.update.mockResolvedValueOnce({ name: "Іван" });
    const formData = new FormData();
    formData.set("playerId", "p1");
    formData.set("userId", "u1");
    const result = await linkPlayerAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(prismaMock.player.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { userId: "u1", email: "u@test.com" },
    });
  });
});
