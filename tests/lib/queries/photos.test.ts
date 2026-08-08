import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    photo: { findMany: vi.fn() },
    tournament: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/r2", () => ({ publicPhotoUrl: (key: string) => `https://pub-test.r2.dev/${key}` }));

import { getPhotosByTournament, getTournamentsWithPhotos } from "@/lib/queries/photos";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.photo.findMany.mockResolvedValue([]);
  prismaMock.tournament.findMany.mockResolvedValue([]);
});

describe("getPhotosByTournament", () => {
  it("queries newest-first, scoped to the tournament", async () => {
    await getPhotosByTournament("t1");
    expect(prismaMock.photo.findMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      orderBy: { createdAt: "desc" },
      select: { id: true, key: true, caption: true },
    });
  });

  it("maps each photo's R2 key to a public URL", async () => {
    prismaMock.photo.findMany.mockResolvedValueOnce([
      { id: "p1", key: "tournaments/t1/a.jpg", caption: "Фінал" },
    ]);
    const result = await getPhotosByTournament("t1");
    expect(result).toEqual([
      { id: "p1", url: "https://pub-test.r2.dev/tournaments/t1/a.jpg", caption: "Фінал" },
    ]);
  });
});

describe("getTournamentsWithPhotos", () => {
  it("only queries tournaments with at least one photo, newest first, with a cover and count", async () => {
    await getTournamentsWithPhotos();
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith({
      where: { photos: { some: {} } },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        photos: { orderBy: { createdAt: "desc" }, take: 1, select: { key: true } },
        _count: { select: { photos: true } },
      },
    });
  });
});
