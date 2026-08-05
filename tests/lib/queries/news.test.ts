import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { newsPost: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getNewsPostById, getNewsPosts, getNewsPostsPage } from "@/lib/queries/news";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.newsPost.findMany.mockResolvedValue([]);
  prismaMock.newsPost.count.mockResolvedValue(0);
});

describe("getNewsPosts", () => {
  it("orders newest-first and forwards the limit", async () => {
    await getNewsPosts(3);
    expect(prismaMock.newsPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 3 }),
    );
  });
});

describe("getNewsPostsPage", () => {
  it("builds an empty where clause with no query", async () => {
    await getNewsPostsPage(20);
    expect(prismaMock.newsPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("filters by title when a query is given", async () => {
    await getNewsPostsPage(20, "сезон");
    expect(prismaMock.newsPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { title: { contains: "сезон", mode: "insensitive" } } }),
    );
    expect(prismaMock.newsPost.count).toHaveBeenCalledWith({
      where: { title: { contains: "сезон", mode: "insensitive" } },
    });
  });

  it("returns both the page and the total count", async () => {
    prismaMock.newsPost.findMany.mockResolvedValueOnce([{ id: "n1" }]);
    prismaMock.newsPost.count.mockResolvedValueOnce(7);
    const result = await getNewsPostsPage(1);
    expect(result).toEqual({ posts: [{ id: "n1" }], total: 7 });
  });
});

describe("getNewsPostById", () => {
  it("looks up by id", async () => {
    await getNewsPostById("n1");
    expect(prismaMock.newsPost.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "n1" } }),
    );
  });
});
