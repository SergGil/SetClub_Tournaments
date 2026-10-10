import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireDomainAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelPhoto: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObject: deleteObjectMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import {
  confirmPadelPhotoUploadAction,
  deletePadelPhotoAction,
  setPadelTournamentCoverPhotoAction,
} from "@/lib/actions/padel-photos";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  deleteObjectMock.mockResolvedValue(undefined);
  // The callback form runs against the same mock client.
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe("confirmPadelPhotoUploadAction", () => {
  it("returns an error for a missing tournamentId, without touching the DB", async () => {
    const result = await confirmPadelPhotoUploadAction("", "padel-tournaments/t1/photo.jpg");
    expect(result.error).toBeDefined();
    expect(prismaMock.padelPhoto.create).not.toHaveBeenCalled();
  });

  it("creates the photo row and logs it on success", async () => {
    prismaMock.padelPhoto.create.mockResolvedValueOnce({
      id: "photo-1",
      tournament: { name: "Падел кубок" },
    });
    const result = await confirmPadelPhotoUploadAction("t1", "padel-tournaments/t1/photo.jpg");
    expect(result).toEqual({});
    expect(prismaMock.padelPhoto.create).toHaveBeenCalledWith({
      data: { tournamentId: "t1", key: "padel-tournaments/t1/photo.jpg", caption: null, uploadedById: "admin-1" },
      include: { tournament: { select: { name: true } } },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.photo.upload", entityId: "photo-1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/padel/t1");
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/padel/tournaments/t1");
  });

  it("cleans up the R2 object and reports a friendly error when the tournament is gone", async () => {
    prismaMock.padelPhoto.create.mockRejectedValueOnce({ code: "P2003" });
    const result = await confirmPadelPhotoUploadAction(
      "missing-tournament",
      "padel-tournaments/missing-tournament/photo.jpg",
    );
    expect(result.error).toContain("не знайдено");
    expect(deleteObjectMock).toHaveBeenCalledWith("padel-tournaments/missing-tournament/photo.jpg");
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a key that wasn't presigned for this tournament, without touching the DB or R2", async () => {
    const result = await confirmPadelPhotoUploadAction("t1", "padel-tournaments/other-tournament/photo.jpg");
    expect(result.error).toBeDefined();
    expect(prismaMock.padelPhoto.create).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("reports a friendly error (not an unhandled exception) on a retried confirm of an already-confirmed key", async () => {
    prismaMock.padelPhoto.create.mockRejectedValueOnce({ code: "P2002" });
    const result = await confirmPadelPhotoUploadAction("t1", "padel-tournaments/t1/photo.jpg");
    expect(result.error).toBe("Це фото вже завантажено");
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });
});

describe("deletePadelPhotoAction", () => {
  it("reports a friendly error when the photo is already gone", async () => {
    prismaMock.padelPhoto.delete.mockRejectedValueOnce({ code: "P2025" });
    const result = await deletePadelPhotoAction("photo-1");
    expect(result.error).toContain("вже видалили");
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("deletes the DB row, best-effort deletes the R2 object, and logs it", async () => {
    prismaMock.padelPhoto.delete.mockResolvedValueOnce({
      id: "photo-1",
      key: "padel-tournaments/t1/photo.jpg",
      tournamentId: "t1",
      tournament: { name: "Падел кубок" },
    });
    const result = await deletePadelPhotoAction("photo-1");
    expect(result).toEqual({});
    expect(deleteObjectMock).toHaveBeenCalledWith("padel-tournaments/t1/photo.jpg");
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.photo.delete", entityId: "photo-1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/padel/tournaments/t1");
    // Deletable from the admin Padel tournament's "Фото" tab too.
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/padel/tournaments/t1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery");
    expect(revalidatePathMock).toHaveBeenCalledWith("/gallery/padel/t1");
  });

  it("still succeeds and logs even if the R2 delete fails", async () => {
    prismaMock.padelPhoto.delete.mockResolvedValueOnce({
      id: "photo-1",
      key: "padel-tournaments/t1/photo.jpg",
      tournamentId: "t1",
      tournament: { name: "Падел кубок" },
    });
    deleteObjectMock.mockRejectedValueOnce(new Error("network error"));
    const result = await deletePadelPhotoAction("photo-1");
    expect(result).toEqual({});
    expect(logAuditMock).toHaveBeenCalled();
  });
});

describe("setPadelTournamentCoverPhotoAction", () => {
  const photoRow = { id: "photo-2", tournamentId: "t1", tournament: { name: "Кубок клубу" } };

  it("rejects a non-admin before touching the DB", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(setPadelTournamentCoverPhotoAction("photo-2")).rejects.toThrow("Forbidden");
    expect(prismaMock.padelPhoto.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error for an empty id, without touching the DB", async () => {
    const result = await setPadelTournamentCoverPhotoAction("");
    expect(result.error).toBeDefined();
    expect(prismaMock.padelPhoto.findUnique).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the photo no longer exists", async () => {
    prismaMock.padelPhoto.findUnique.mockResolvedValueOnce(null);
    const result = await setPadelTournamentCoverPhotoAction("photo-2");
    expect(result.error).toContain("вже видалили");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("clears every other cover of the same tournament, then marks this photo, in one transaction", async () => {
    prismaMock.padelPhoto.findUnique.mockResolvedValueOnce(photoRow);
    const calls: string[] = [];
    prismaMock.padelPhoto.updateMany.mockImplementationOnce(async () => {
      calls.push("clear");
      return { count: 1 };
    });
    prismaMock.padelPhoto.update.mockImplementationOnce(async () => {
      calls.push("set");
      return photoRow;
    });

    const result = await setPadelTournamentCoverPhotoAction("photo-2");

    expect(result).toEqual({});
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.padelPhoto.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1", isCover: true, id: { not: "photo-2" } },
      data: { isCover: false },
    });
    expect(prismaMock.padelPhoto.update).toHaveBeenCalledWith({
      where: { id: "photo-2" },
      data: { isCover: true },
    });
    expect(calls).toEqual(["clear", "set"]);
  });

  it("turns a photo deleted mid-flight into the same friendly error, without logging or revalidating", async () => {
    prismaMock.padelPhoto.findUnique.mockResolvedValueOnce(photoRow);
    prismaMock.padelPhoto.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.padelPhoto.update.mockRejectedValueOnce({ code: "P2025" });

    const result = await setPadelTournamentCoverPhotoAction("photo-2");

    expect(result.error).toContain("вже видалили");
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs the change and refreshes every page that shows the cover, including the homepage fallback", async () => {
    prismaMock.padelPhoto.findUnique.mockResolvedValueOnce(photoRow);
    prismaMock.padelPhoto.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.padelPhoto.update.mockResolvedValueOnce(photoRow);

    await setPadelTournamentCoverPhotoAction("photo-2");

    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "padel.photo.cover", entityType: "PadelPhoto", entityId: "photo-2" }),
    );
    for (const path of ["/padel/tournaments/t1", "/admin/padel/tournaments/t1", "/gallery", "/gallery/padel/t1", "/"]) {
      expect(revalidatePathMock).toHaveBeenCalledWith(path);
    }
  });
});
