import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { newsPost: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

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
      data: expect.objectContaining({ authorId: "admin-1" }),
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "news.create" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});

describe("updateNewsPostAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await updateNewsPostAction({}, newsFormData());
    expect(result.error).toBe("Новину не знайдено");
  });

  it("returns an error when the post was deleted concurrently", async () => {
    prismaMock.newsPost.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateNewsPostAction({}, newsFormData({ id: "n1" }));
    expect(result.error).toContain("вже видалили");
  });

  it("updates the post on success", async () => {
    prismaMock.newsPost.update.mockResolvedValueOnce({});
    const result = await updateNewsPostAction({}, newsFormData({ id: "n1" }));
    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "news.update" }));
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
    prismaMock.newsPost.delete.mockResolvedValueOnce({ id: "n1", title: "Новий сезон" });
    const formData = new FormData();
    formData.set("id", "n1");
    const result = await deleteNewsPostAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Новий сезон") }),
    );
  });
});
