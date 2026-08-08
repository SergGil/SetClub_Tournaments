import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { photo: { create: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObject: deleteObjectMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { confirmPhotoUploadAction, deletePhotoAction } from "@/lib/actions/photos";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  deleteObjectMock.mockResolvedValue(undefined);
});

describe("confirmPhotoUploadAction", () => {
  it("returns an error for a missing tournamentId, without touching the DB", async () => {
    const result = await confirmPhotoUploadAction("", "tournaments/t1/photo.jpg");
    expect(result.error).toBeDefined();
    expect(prismaMock.photo.create).not.toHaveBeenCalled();
  });

  it("creates the photo row and logs it on success", async () => {
    prismaMock.photo.create.mockResolvedValueOnce({
      id: "photo-1",
      tournament: { name: "Кубок клубу" },
    });
    const result = await confirmPhotoUploadAction("t1", "tournaments/t1/photo.jpg");
    expect(result).toEqual({});
    expect(prismaMock.photo.create).toHaveBeenCalledWith({
      data: { tournamentId: "t1", key: "tournaments/t1/photo.jpg", caption: null, uploadedById: "admin-1" },
      include: { tournament: { select: { name: true } } },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "photo.upload", entityId: "photo-1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/tournaments/t1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/t1");
  });

  it("cleans up the R2 object and reports a friendly error when the tournament is gone", async () => {
    prismaMock.photo.create.mockRejectedValueOnce({ code: "P2003" });
    const result = await confirmPhotoUploadAction(
      "missing-tournament",
      "tournaments/missing-tournament/photo.jpg",
    );
    expect(result.error).toContain("не знайдено");
    expect(deleteObjectMock).toHaveBeenCalledWith("tournaments/missing-tournament/photo.jpg");
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a key that wasn't presigned for this tournament, without touching the DB or R2", async () => {
    const result = await confirmPhotoUploadAction("t1", "tournaments/other-tournament/photo.jpg");
    expect(result.error).toBeDefined();
    expect(prismaMock.photo.create).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

describe("deletePhotoAction", () => {
  it("reports a friendly error when the photo is already gone", async () => {
    prismaMock.photo.delete.mockRejectedValueOnce({ code: "P2025" });
    const result = await deletePhotoAction("photo-1");
    expect(result.error).toContain("вже видалили");
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("deletes the DB row, best-effort deletes the R2 object, and logs it", async () => {
    prismaMock.photo.delete.mockResolvedValueOnce({
      id: "photo-1",
      key: "tournaments/t1/photo.jpg",
      tournamentId: "t1",
      tournament: { name: "Кубок клубу" },
    });
    const result = await deletePhotoAction("photo-1");
    expect(result).toEqual({});
    expect(deleteObjectMock).toHaveBeenCalledWith("tournaments/t1/photo.jpg");
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "photo.delete", entityId: "photo-1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/tournaments/t1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/t1");
  });

  it("still succeeds and logs even if the R2 delete fails", async () => {
    prismaMock.photo.delete.mockResolvedValueOnce({
      id: "photo-1",
      key: "tournaments/t1/photo.jpg",
      tournamentId: "t1",
      tournament: { name: "Кубок клубу" },
    });
    deleteObjectMock.mockRejectedValueOnce(new Error("network error"));
    const result = await deletePhotoAction("photo-1");
    expect(result).toEqual({});
    expect(logAuditMock).toHaveBeenCalled();
  });
});
