import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelTournament: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    padelTournamentParticipant: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getAllPadelTournamentParticipants,
  getPadelTournamentById,
  getPadelTournaments,
  getPadelTournamentsPage,
} from "@/lib/queries/padel-tournaments";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelTournament.findMany.mockResolvedValue([]);
  prismaMock.padelTournament.count.mockResolvedValue(0);
});

describe("getPadelTournaments", () => {
  it("orders newest-first with participant/match counts", async () => {
    await getPadelTournaments();
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { participants: true, matches: true } } },
    });
  });
});

describe("getPadelTournamentsPage", () => {
  it("defaults to sorting by startDate descending", async () => {
    await getPadelTournamentsPage(20);
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { startDate: "desc" } }),
    );
  });

  it("sorts by participant count when asked", async () => {
    await getPadelTournamentsPage(20, undefined, { key: "participants", dir: "asc" });
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { participants: { _count: "asc" } } }),
    );
  });

  it("sorts by match count when asked", async () => {
    await getPadelTournamentsPage(20, undefined, { key: "matches", dir: "desc" });
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { matches: { _count: "desc" } } }),
    );
  });

  it("filters by name when a query is given", async () => {
    await getPadelTournamentsPage(20, "Кубок");
    expect(prismaMock.padelTournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { contains: "Кубок", mode: "insensitive" } } }),
    );
    expect(prismaMock.padelTournament.count).toHaveBeenCalledWith({
      where: { name: { contains: "Кубок", mode: "insensitive" } },
    });
  });

  it("returns both the page and the total count", async () => {
    prismaMock.padelTournament.findMany.mockResolvedValueOnce([{ id: "t1" }]);
    prismaMock.padelTournament.count.mockResolvedValueOnce(9);
    const result = await getPadelTournamentsPage(1);
    expect(result).toEqual({ tournaments: [{ id: "t1" }], total: 9 });
  });
});

describe("getPadelTournamentById / getAllPadelTournamentParticipants", () => {
  it("looks up a tournament with its roster", async () => {
    await getPadelTournamentById("t1");
    expect(prismaMock.padelTournament.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("fetches every participation club-wide, newest tournament first", async () => {
    await getAllPadelTournamentParticipants();
    expect(prismaMock.padelTournamentParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ tournament: { startDate: "desc" } }, { joinedAt: "asc" }] }),
    );
  });
});
