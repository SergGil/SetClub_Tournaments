import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    photo: { findMany: vi.fn() },
    tournament: { findMany: vi.fn() },
    padelPhoto: { findMany: vi.fn() },
    padelTournament: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/r2", () => ({ publicPhotoUrl: (key: string) => `https://pub-test.r2.dev/${key}` }));

import {
  getPhotosByTournament,
  getTournamentsWithPhotos,
  getTournamentsWithPhotosAcrossSports,
} from "@/lib/queries/photos";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.photo.findMany.mockResolvedValue([]);
  prismaMock.tournament.findMany.mockResolvedValue([]);
  prismaMock.padelPhoto.findMany.mockResolvedValue([]);
  prismaMock.padelTournament.findMany.mockResolvedValue([]);
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

  it("passes through the cover photo and count Prisma returns", async () => {
    prismaMock.tournament.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Кубок клубу",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        photos: [{ key: "tournaments/t1/cover.jpg" }],
        _count: { photos: 5 },
      },
    ]);
    const result = await getTournamentsWithPhotos();
    expect(result).toEqual([
      {
        id: "t1",
        name: "Кубок клубу",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        photos: [{ key: "tournaments/t1/cover.jpg" }],
        _count: { photos: 5 },
      },
    ]);
  });
});

describe("getTournamentsWithPhotosAcrossSports", () => {
  it("merges Tennis and Padel tournaments into one sport-tagged, date-sorted feed", async () => {
    prismaMock.tournament.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Кубок клубу",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        photos: [{ key: "tournaments/t1/cover.jpg" }],
        _count: { photos: 5 },
      },
    ]);
    prismaMock.padelTournament.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        name: "Падел кубок",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-02"),
        photos: [{ key: "padel-tournaments/p1/cover.jpg" }],
        _count: { photos: 2 },
      },
    ]);

    const result = await getTournamentsWithPhotosAcrossSports();

    expect(result).toEqual([
      {
        sport: "PADEL",
        id: "p1",
        name: "Падел кубок",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-02"),
        coverKey: "padel-tournaments/p1/cover.jpg",
        photoCount: 2,
      },
      {
        sport: "TENNIS",
        id: "t1",
        name: "Кубок клубу",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-02"),
        coverKey: "tournaments/t1/cover.jpg",
        photoCount: 5,
      },
    ]);
  });
});
