import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelPhoto: { findMany: vi.fn() },
    padelTournament: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/r2", () => ({ publicPhotoUrl: (key: string) => `https://pub-test.r2.dev/${key}` }));

import { getPadelTournamentsWithPhotos, getPhotosByPadelTournament } from "@/lib/queries/padel-photos";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelPhoto.findMany.mockResolvedValue([]);
  prismaMock.padelTournament.findMany.mockResolvedValue([]);
});

describe("getPhotosByPadelTournament", () => {
  it("queries newest-first, scoped to the tournament", async () => {
    await getPhotosByPadelTournament("t1");
    expect(prismaMock.padelPhoto.findMany).toHaveBeenCalledWith({
      where: { tournamentId: "t1" },
      orderBy: { createdAt: "desc" },
      select: { id: true, key: true, caption: true },
    });
  });

  it("maps each photo's R2 key to a public URL", async () => {
    prismaMock.padelPhoto.findMany.mockResolvedValueOnce([
      { id: "p1", key: "padel-tournaments/t1/a.jpg", caption: "Фінал" },
    ]);
    const result = await getPhotosByPadelTournament("t1");
    expect(result).toEqual([
      { id: "p1", url: "https://pub-test.r2.dev/padel-tournaments/t1/a.jpg", caption: "Фінал" },
    ]);
  });
});

describe("getPadelTournamentsWithPhotos", () => {
  it("only queries tournaments with at least one photo, newest first, with a cover and count", async () => {
    await getPadelTournamentsWithPhotos();
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith({
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

  it("passes through the cover photo and count Prisma returns", async () => {
    prismaMock.padelTournament.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Кубок клубу (Падел)",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        photos: [{ key: "padel-tournaments/t1/cover.jpg" }],
        _count: { photos: 5 },
      },
    ]);
    const result = await getPadelTournamentsWithPhotos();
    expect(result).toEqual([
      {
        id: "t1",
        name: "Кубок клубу (Падел)",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        photos: [{ key: "padel-tournaments/t1/cover.jpg" }],
        _count: { photos: 5 },
      },
    ]);
  });
});
