import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAnyDomainAdminMock } = vi.hoisted(() => ({ requireAnyDomainAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAnyDomainAdmin: requireAnyDomainAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { homeGalleryPhoto: { create: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { deleteObjectMock } = vi.hoisted(() => ({ deleteObjectMock: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteObject: deleteObjectMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { confirmHomeGalleryPhotoAction, deleteHomeGalleryPhotoAction } from "@/lib/actions/home-gallery";

const KEY = "home-gallery/abc-photo.jpg";

beforeEach(() => {
  vi.clearAllMocks();
  requireAnyDomainAdminMock.mockResolvedValue(session);
  deleteObjectMock.mockResolvedValue(undefined);
});

describe("confirmHomeGalleryPhotoAction", () => {
  it("rejects a key outside the home-gallery/ prefix without writing", async () => {
    const result = await confirmHomeGalleryPhotoAction("tournaments/t1/x.jpg");
    expect(result.error).toBe("Ключ файлу некоректний");
    expect(prismaMock.homeGalleryPhoto.create).not.toHaveBeenCalled();
  });

  it("creates the row, logs it with the caption and revalidates the homepage", async () => {
    prismaMock.homeGalleryPhoto.create.mockResolvedValueOnce({ id: "g1", key: KEY, caption: "Дегустація" });
    const result = await confirmHomeGalleryPhotoAction(KEY, " Дегустація ");
    expect(result).toEqual({});
    expect(prismaMock.homeGalleryPhoto.create).toHaveBeenCalledWith({ data: { key: KEY, caption: "Дегустація" } });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "home.gallery.upload", summary: expect.stringContaining("Дегустація") }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/home");
  });

  it("works without a caption", async () => {
    prismaMock.homeGalleryPhoto.create.mockResolvedValueOnce({ id: "g1", key: KEY, caption: null });
    await confirmHomeGalleryPhotoAction(KEY);
    expect(prismaMock.homeGalleryPhoto.create).toHaveBeenCalledWith({ data: { key: KEY, caption: null } });
  });

  it("turns a duplicate confirm (unique key) into a friendly error instead of throwing", async () => {
    prismaMock.homeGalleryPhoto.create.mockRejectedValueOnce({ code: "P2002", meta: { target: ["key"] } });
    const result = await confirmHomeGalleryPhotoAction(KEY);
    expect(result).toEqual({ error: "Це фото вже завантажено" });
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected database errors", async () => {
    prismaMock.homeGalleryPhoto.create.mockRejectedValueOnce(new Error("db down"));
    await expect(confirmHomeGalleryPhotoAction(KEY)).rejects.toThrow("db down");
  });

  it("passes the request through so a mobile bearer token authorizes it", async () => {
    prismaMock.homeGalleryPhoto.create.mockResolvedValueOnce({ id: "g1", key: KEY, caption: null });
    const request = new Request("https://x.test");
    await confirmHomeGalleryPhotoAction(KEY, undefined, request);
    expect(requireAnyDomainAdminMock).toHaveBeenCalledWith(request);
  });
});

describe("deleteHomeGalleryPhotoAction", () => {
  it("deletes the row, then the R2 object best-effort, and logs it", async () => {
    prismaMock.homeGalleryPhoto.delete.mockResolvedValueOnce({ id: "g1", key: KEY });
    const result = await deleteHomeGalleryPhotoAction("g1");
    expect(result).toEqual({});
    expect(prismaMock.homeGalleryPhoto.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
    expect(deleteObjectMock).toHaveBeenCalledWith(KEY);
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "home.gallery.delete" }));
  });

  it("does not fail when the R2 delete fails (the row is already gone)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.homeGalleryPhoto.delete.mockResolvedValueOnce({ id: "g1", key: KEY });
    deleteObjectMock.mockRejectedValueOnce(new Error("network error"));
    await expect(deleteHomeGalleryPhotoAction("g1")).resolves.toEqual({});
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it("reports an already-deleted photo instead of throwing", async () => {
    prismaMock.homeGalleryPhoto.delete.mockRejectedValueOnce({ code: "P2025" });
    const result = await deleteHomeGalleryPhotoAction("gone");
    expect(result.error).toMatch(/не знайдено/);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});
