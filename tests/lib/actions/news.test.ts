import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    newsPost: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
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

import { createNewsPostAction, deleteNewsPostAction, updateNewsPostAction } from "@/lib/actions/news";

function newsFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = { title: "Новий сезон", body: "Деталі турніру...", ...overrides };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  deleteObjectMock.mockResolvedValue(undefined);
});

describe("createNewsPostAction", () => {
  it("returns field errors for a blank title, without touching the DB", async () => {
    const result = await createNewsPostAction({}, newsFormData({ title: "" }));
    expect(result.fieldErrors?.title).toBeDefined();
    expect(prismaMock.newsPost.create).not.toHaveBeenCalled();
  });

  it("creates the post with the current admin as author and logs it", async () => {
    prismaMock.newsPost.create.mockResolvedValueOnce({ id: "n1", title: "Новий сезон" });
    const result = await createNewsPostAction({}, newsFormData());
    expect(result).toEqual({ success: true });
    expect(prismaMock.newsPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorId: "admin-1", photoKey: null }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "news.create" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("creates the post with the uploaded cover photo's key", async () => {
    prismaMock.newsPost.create.mockResolvedValueOnce({ id: "n1", title: "Новий сезон" });
    const result = await createNewsPostAction({}, newsFormData({ photoKey: "news/abc-photo.jpg" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.newsPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoKey: "news/abc-photo.jpg" }),
    });
  });

  it("rejects a photo key that wasn't presigned for a news post, without touching the DB", async () => {
    const result = await createNewsPostAction({}, newsFormData({ photoKey: "tournaments/t1/photo.jpg" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.newsPost.create).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the photo key is already used by another post", async () => {
    prismaMock.newsPost.create.mockRejectedValueOnce({ code: "P2002" });
    const result = await createNewsPostAction({}, newsFormData({ photoKey: "news/stolen.jpg" }));
    expect(result.error).toContain("вже використовується в іншій новині");
  });
});

describe("updateNewsPostAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await updateNewsPostAction({}, newsFormData());
    expect(result.error).toBe("Новину не знайдено");
  });

  it("returns an error when the post was deleted concurrently", async () => {
    prismaMock.newsPost.findUniqueOrThrow.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateNewsPostAction({}, newsFormData({ id: "n1" }));
    expect(result.error).toContain("вже видалили");
    expect(prismaMock.newsPost.update).not.toHaveBeenCalled();
  });

  it("updates the post and leaves an untouched photo as-is", async () => {
    prismaMock.newsPost.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "news/old.jpg" });
    prismaMock.newsPost.update.mockResolvedValueOnce({});
    const result = await updateNewsPostAction({}, newsFormData({ id: "n1" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.newsPost.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: expect.objectContaining({ photoKey: "news/old.jpg" }),
    });
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "news.update" }));
  });

  it("replaces the photo and best-effort deletes the old R2 object", async () => {
    prismaMock.newsPost.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "news/old.jpg" });
    prismaMock.newsPost.update.mockResolvedValueOnce({});
    const result = await updateNewsPostAction(
      {},
      newsFormData({ id: "n1", photoKey: "news/new.jpg" }),
    );
    expect(result).toEqual({ success: true });
    expect(prismaMock.newsPost.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: expect.objectContaining({ photoKey: "news/new.jpg" }),
    });
    expect(deleteObjectMock).toHaveBeenCalledWith("news/old.jpg");
  });

  it("clears the photo and deletes the old R2 object when explicitly removed", async () => {
    prismaMock.newsPost.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "news/old.jpg" });
    prismaMock.newsPost.update.mockResolvedValueOnce({});
    const result = await updateNewsPostAction(
      {},
      newsFormData({ id: "n1", removePhoto: "true" }),
    );
    expect(result).toEqual({ success: true });
    expect(prismaMock.newsPost.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: expect.objectContaining({ photoKey: null }),
    });
    expect(deleteObjectMock).toHaveBeenCalledWith("news/old.jpg");
  });

  it("rejects a photo key that wasn't presigned for a news post, without touching the DB", async () => {
    const result = await updateNewsPostAction(
      {},
      newsFormData({ id: "n1", photoKey: "tournaments/t1/photo.jpg" }),
    );
    expect(result.error).toBeDefined();
    expect(prismaMock.newsPost.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.newsPost.update).not.toHaveBeenCalled();
  });

  it("reports a friendly error when reusing another post's still-live photo key", async () => {
    prismaMock.newsPost.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "news/own.jpg" });
    prismaMock.newsPost.update.mockRejectedValueOnce({ code: "P2002" });
    const result = await updateNewsPostAction(
      {},
      newsFormData({ id: "n1", photoKey: "news/someone-elses-post.jpg" }),
    );
    expect(result.error).toContain("вже використовується в іншій новині");
    // The unique constraint blocked the write - the old photo must stay referenced, not be deleted.
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

describe("deleteNewsPostAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deleteNewsPostAction({}, new FormData());
    expect(result.error).toBe("Новину не знайдено");
  });

  it("returns an error when the post was already deleted", async () => {
    prismaMock.newsPost.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "n1");
    const result = await deleteNewsPostAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("deletes the post and logs its title", async () => {
    prismaMock.newsPost.delete.mockResolvedValueOnce({ id: "n1", title: "Новий сезон", photoKey: null });
    const formData = new FormData();
    formData.set("id", "n1");
    const result = await deleteNewsPostAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Новий сезон") }),
    );
  });

  it("best-effort deletes the cover photo's R2 object along with the post", async () => {
    prismaMock.newsPost.delete.mockResolvedValueOnce({
      id: "n1",
      title: "Новий сезон",
      photoKey: "news/old.jpg",
    });
    const formData = new FormData();
    formData.set("id", "n1");
    const result = await deleteNewsPostAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(deleteObjectMock).toHaveBeenCalledWith("news/old.jpg");
  });
});
