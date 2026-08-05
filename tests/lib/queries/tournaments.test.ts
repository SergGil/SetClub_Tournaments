import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    tournamentParticipant: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getAllTournamentParticipants,
  getTournamentById,
  getTournaments,
  getTournamentsPage,
} from "@/lib/queries/tournaments";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tournament.findMany.mockResolvedValue([]);
  prismaMock.tournament.count.mockResolvedValue(0);
});

describe("getTournaments", () => {
  it("orders newest-first with participant/match counts", async () => {
    await getTournaments();
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { participants: true, matches: true } } },
    });
  });
});

describe("getTournamentsPage", () => {
  it("defaults to sorting by startDate descending", async () => {
    await getTournamentsPage(20);
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { startDate: "desc" } }),
    );
  });

  it("sorts by participant count when asked", async () => {
    await getTournamentsPage(20, undefined, { key: "participants", dir: "asc" });
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { participants: { _count: "asc" } } }),
    );
  });

  it("sorts by match count when asked", async () => {
    await getTournamentsPage(20, undefined, { key: "matches", dir: "desc" });
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { matches: { _count: "desc" } } }),
    );
  });

  it("filters by name when a query is given", async () => {
    await getTournamentsPage(20, "Кубок");
    expect(prismaMock.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { contains: "Кубок", mode: "insensitive" } } }),
    );
    expect(prismaMock.tournament.count).toHaveBeenCalledWith({
      where: { name: { contains: "Кубок", mode: "insensitive" } },
    });
  });

  it("returns both the page and the total count", async () => {
    prismaMock.tournament.findMany.mockResolvedValueOnce([{ id: "t1" }]);
    prismaMock.tournament.count.mockResolvedValueOnce(9);
    const result = await getTournamentsPage(1);
    expect(result).toEqual({ tournaments: [{ id: "t1" }], total: 9 });
  });
});

describe("getTournamentById / getAllTournamentParticipants", () => {
  it("looks up a tournament with its roster", async () => {
    await getTournamentById("t1");
    expect(prismaMock.tournament.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("fetches every participation club-wide, newest tournament first", async () => {
    await getAllTournamentParticipants();
    expect(prismaMock.tournamentParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ tournament: { startDate: "desc" } }, { joinedAt: "asc" }] }),
    );
  });
});
