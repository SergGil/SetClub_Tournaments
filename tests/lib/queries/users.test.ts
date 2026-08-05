import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getUsers, getUsersPage } from "@/lib/queries/users";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.user.count.mockResolvedValue(0);
});

describe("getUsers", () => {
  it("orders oldest-first", async () => {
    await getUsers();
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
  });
});

describe("getUsersPage", () => {
  it("builds an empty where clause with no query", async () => {
    await getUsersPage(20);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("searches by name or email when a query is given", async () => {
    await getUsersPage(20, "iva");
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "iva", mode: "insensitive" } },
            { email: { contains: "iva", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("returns both the page and the total count", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1" }]);
    prismaMock.user.count.mockResolvedValueOnce(5);
    const result = await getUsersPage(1);
    expect(result).toEqual({ users: [{ id: "u1" }], total: 5 });
  });
});
