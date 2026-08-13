import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    menuSection: { findMany: vi.fn(), findUnique: vi.fn() },
    menuItem: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getActiveMenuSections, getMenuItemById, getMenuSectionById, getMenuSections } from "@/lib/queries/menu";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.menuSection.findMany.mockResolvedValue([]);
});

describe("getMenuSections", () => {
  it("orders sections and items by sortOrder, including every item regardless of active state", async () => {
    await getMenuSections();
    expect(prismaMock.menuSection.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });
});

describe("getActiveMenuSections", () => {
  it("only queries active sections with active items", async () => {
    await getActiveMenuSections();
    expect(prismaMock.menuSection.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { items: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
  });

  it("drops sections that end up with no items", async () => {
    prismaMock.menuSection.findMany.mockResolvedValueOnce([
      { id: "s1", name: "Кава", items: [{ id: "i1" }] },
      { id: "s2", name: "Порожня секція", items: [] },
    ]);
    const result = await getActiveMenuSections();
    expect(result).toEqual([{ id: "s1", name: "Кава", items: [{ id: "i1" }] }]);
  });
});

describe("getMenuSectionById", () => {
  it("looks up by id", async () => {
    await getMenuSectionById("s1");
    expect(prismaMock.menuSection.findUnique).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});

describe("getMenuItemById", () => {
  it("looks up by id", async () => {
    await getMenuItemById("i1");
    expect(prismaMock.menuItem.findUnique).toHaveBeenCalledWith({ where: { id: "i1" } });
  });
});
