import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireDomainAdminMock } = vi.hoisted(() => ({ requireDomainAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireDomainAdmin: requireDomainAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    menuSection: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    menuItem: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
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
  createMenuItemAction,
  createMenuSectionAction,
  deleteMenuItemAction,
  deleteMenuSectionAction,
  toggleMenuItemActiveAction,
  toggleMenuSectionActiveAction,
  updateMenuItemAction,
  updateMenuSectionAction,
} from "@/lib/actions/menu";

function sectionFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = { name: "Кава", tagline: "", layout: "LIST", sortOrder: "10", ...overrides };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) formData.set(key, value);
  return formData;
}

function itemFormData(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    sectionId: "s1",
    name: "Латте",
    price: "95",
    description: "",
    sortOrder: "0",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireDomainAdminMock.mockResolvedValue(session);
  deleteObjectMock.mockResolvedValue(undefined);
});

describe("createMenuSectionAction", () => {
  it("requires COFFEE domain admin", async () => {
    prismaMock.menuSection.create.mockResolvedValueOnce({ id: "sec1", name: "Кава" });
    await createMenuSectionAction({}, sectionFormData());
    expect(requireDomainAdminMock).toHaveBeenCalledWith("COFFEE");
  });

  it("returns field errors for a blank name, without touching the DB", async () => {
    const result = await createMenuSectionAction({}, sectionFormData({ name: "" }));
    expect(result.fieldErrors?.name).toBeDefined();
    expect(prismaMock.menuSection.create).not.toHaveBeenCalled();
  });

  it("creates the section and logs it", async () => {
    prismaMock.menuSection.create.mockResolvedValueOnce({ id: "sec1", name: "Кава" });
    const result = await createMenuSectionAction({}, sectionFormData());
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuSection.create).toHaveBeenCalledWith({
      data: { name: "Кава", tagline: null, layout: "LIST", sortOrder: 10 },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "menu.section.create", entityId: "sec1" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/menu");
    expect(revalidatePathMock).toHaveBeenCalledWith("/coffee");
  });
});

describe("updateMenuSectionAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await updateMenuSectionAction({}, sectionFormData());
    expect(result.error).toBe("Секцію не знайдено");
    expect(prismaMock.menuSection.update).not.toHaveBeenCalled();
  });

  it("returns an error when the section was deleted concurrently", async () => {
    prismaMock.menuSection.update.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateMenuSectionAction({}, sectionFormData({ id: "sec1" }));
    expect(result.error).toContain("вже видалили");
  });

  it("updates the section and logs it", async () => {
    prismaMock.menuSection.update.mockResolvedValueOnce({});
    const result = await updateMenuSectionAction({}, sectionFormData({ id: "sec1", name: "Чай" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuSection.update).toHaveBeenCalledWith({
      where: { id: "sec1" },
      data: { name: "Чай", tagline: null, layout: "LIST", sortOrder: 10 },
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "menu.section.update" }));
  });
});

describe("toggleMenuSectionActiveAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await toggleMenuSectionActiveAction({}, new FormData());
    expect(result.error).toBe("Секцію не знайдено");
  });

  it("returns an error when the section was deleted concurrently", async () => {
    prismaMock.menuSection.update.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "sec1");
    formData.set("active", "false");
    const result = await toggleMenuSectionActiveAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("hides an active section and logs a deactivate action", async () => {
    prismaMock.menuSection.update.mockResolvedValueOnce({ name: "Кава" });
    const formData = new FormData();
    formData.set("id", "sec1");
    formData.set("active", "false");
    const result = await toggleMenuSectionActiveAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuSection.update).toHaveBeenCalledWith({ where: { id: "sec1" }, data: { active: false } });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "menu.section.deactivate" }),
    );
  });

  it("shows a hidden section and logs an activate action", async () => {
    prismaMock.menuSection.update.mockResolvedValueOnce({ name: "Кава" });
    const formData = new FormData();
    formData.set("id", "sec1");
    formData.set("active", "true");
    const result = await toggleMenuSectionActiveAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuSection.update).toHaveBeenCalledWith({ where: { id: "sec1" }, data: { active: true } });
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "menu.section.activate" }),
    );
  });
});

describe("deleteMenuSectionAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deleteMenuSectionAction({}, new FormData());
    expect(result.error).toBe("Секцію не знайдено");
  });

  it("returns an error when the section was already deleted", async () => {
    prismaMock.menuSection.findUnique.mockResolvedValueOnce(null);
    prismaMock.menuSection.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "sec1");
    const result = await deleteMenuSectionAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("deletes the section and best-effort cleans up every child item's photo", async () => {
    prismaMock.menuSection.findUnique.mockResolvedValueOnce({
      name: "Кава",
      items: [{ photoKey: "menu/one.jpg" }, { photoKey: null }, { photoKey: "menu/two.jpg" }],
    });
    prismaMock.menuSection.delete.mockResolvedValueOnce({ id: "sec1", name: "Кава" });
    const formData = new FormData();
    formData.set("id", "sec1");
    const result = await deleteMenuSectionAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(deleteObjectMock).toHaveBeenCalledWith("menu/one.jpg");
    expect(deleteObjectMock).toHaveBeenCalledWith("menu/two.jpg");
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ action: "menu.section.delete", summary: expect.stringContaining("Кава") }),
    );
  });
});

describe("createMenuItemAction", () => {
  it("returns field errors for a blank name, without touching the DB", async () => {
    const result = await createMenuItemAction({}, itemFormData({ name: "" }));
    expect(result.fieldErrors?.name).toBeDefined();
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("creates the item without a photo and logs it", async () => {
    prismaMock.menuItem.create.mockResolvedValueOnce({ id: "i1", name: "Латте", price: 95 });
    const result = await createMenuItemAction({}, itemFormData());
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: { sectionId: "s1", name: "Латте", price: 95, description: null, sortOrder: 0, photoKey: null },
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "menu.item.create" }));
  });

  it("creates the item with the uploaded photo's key", async () => {
    prismaMock.menuItem.create.mockResolvedValueOnce({ id: "i1", name: "Латте" });
    const result = await createMenuItemAction({}, itemFormData({ photoKey: "menu/abc-latte.jpg" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ photoKey: "menu/abc-latte.jpg" }),
    });
  });

  it("rejects a photo key that wasn't presigned for a menu item, without touching the DB", async () => {
    const result = await createMenuItemAction({}, itemFormData({ photoKey: "news/photo.jpg" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the photo key is already used by another item", async () => {
    prismaMock.menuItem.create.mockRejectedValueOnce({ code: "P2002" });
    const result = await createMenuItemAction({}, itemFormData({ photoKey: "menu/stolen.jpg" }));
    expect(result.error).toContain("вже використовується в іншому пункті меню");
  });
});

describe("updateMenuItemAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await updateMenuItemAction({}, itemFormData());
    expect(result.error).toBe("Напій не знайдено");
  });

  it("returns an error when the item was deleted concurrently", async () => {
    prismaMock.menuItem.findUniqueOrThrow.mockRejectedValueOnce({ code: "P2025" });
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1" }));
    expect(result.error).toContain("вже видалили");
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it("updates the item and leaves an untouched photo as-is", async () => {
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "menu/old.jpg" });
    prismaMock.menuItem.update.mockResolvedValueOnce({});
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ photoKey: "menu/old.jpg" }),
    });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("replaces the photo and best-effort deletes the old R2 object", async () => {
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "menu/old.jpg" });
    prismaMock.menuItem.update.mockResolvedValueOnce({});
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1", photoKey: "menu/new.jpg" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ photoKey: "menu/new.jpg" }),
    });
    expect(deleteObjectMock).toHaveBeenCalledWith("menu/old.jpg");
  });

  it("clears the photo and deletes the old R2 object when explicitly removed", async () => {
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "menu/old.jpg" });
    prismaMock.menuItem.update.mockResolvedValueOnce({});
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1", removePhoto: "true" }));
    expect(result).toEqual({ success: true });
    expect(prismaMock.menuItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ photoKey: null }),
    });
    expect(deleteObjectMock).toHaveBeenCalledWith("menu/old.jpg");
  });

  it("rejects a photo key that wasn't presigned for a menu item, without touching the DB", async () => {
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1", photoKey: "news/photo.jpg" }));
    expect(result.error).toBeDefined();
    expect(prismaMock.menuItem.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it("reports a friendly error when reusing another item's still-live photo key", async () => {
    prismaMock.menuItem.findUniqueOrThrow.mockResolvedValueOnce({ photoKey: "menu/own.jpg" });
    prismaMock.menuItem.update.mockRejectedValueOnce({ code: "P2002" });
    const result = await updateMenuItemAction({}, itemFormData({ id: "i1", photoKey: "menu/someone-elses.jpg" }));
    expect(result.error).toContain("вже використовується в іншому пункті меню");
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

describe("toggleMenuItemActiveAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await toggleMenuItemActiveAction({}, new FormData());
    expect(result.error).toBe("Напій не знайдено");
  });

  it("returns an error when the item was deleted concurrently", async () => {
    prismaMock.menuItem.update.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "i1");
    formData.set("active", "false");
    const result = await toggleMenuItemActiveAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("toggles visibility and logs the action", async () => {
    prismaMock.menuItem.update.mockResolvedValueOnce({ name: "Латте" });
    const formData = new FormData();
    formData.set("id", "i1");
    formData.set("active", "false");
    const result = await toggleMenuItemActiveAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "menu.item.deactivate" }));
  });
});

describe("deleteMenuItemAction", () => {
  it("returns an error when id is missing", async () => {
    const result = await deleteMenuItemAction({}, new FormData());
    expect(result.error).toBe("Напій не знайдено");
  });

  it("returns an error when the item was already deleted", async () => {
    prismaMock.menuItem.delete.mockRejectedValueOnce({ code: "P2025" });
    const formData = new FormData();
    formData.set("id", "i1");
    const result = await deleteMenuItemAction({}, formData);
    expect(result.error).toContain("вже видалили");
  });

  it("deletes the item and logs its name", async () => {
    prismaMock.menuItem.delete.mockResolvedValueOnce({ id: "i1", name: "Латте", photoKey: null });
    const formData = new FormData();
    formData.set("id", "i1");
    const result = await deleteMenuItemAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(logAuditMock).toHaveBeenCalledWith(
      session.user,
      expect.objectContaining({ summary: expect.stringContaining("Латте") }),
    );
  });

  it("best-effort deletes the photo's R2 object along with the item", async () => {
    prismaMock.menuItem.delete.mockResolvedValueOnce({ id: "i1", name: "Латте", photoKey: "menu/old.jpg" });
    const formData = new FormData();
    formData.set("id", "i1");
    const result = await deleteMenuItemAction({}, formData);
    expect(result).toEqual({ success: true });
    expect(deleteObjectMock).toHaveBeenCalledWith("menu/old.jpg");
  });
});
