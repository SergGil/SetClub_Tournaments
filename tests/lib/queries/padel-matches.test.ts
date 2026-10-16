import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    padelMatch: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    padelTournamentParticipant: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getAllPadelMatches,
  getPadelMatchById,
  getPadelMatchesPage,
  getPadelSeasonMatchCount,
  getPadelTournamentMatches,
  getPlayerPadelMatches,
  getRecentCompletedPadelMatches,
} from "@/lib/queries/padel-matches";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.padelMatch.findMany.mockResolvedValue([]);
  prismaMock.padelMatch.count.mockResolvedValue(0);
  prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([]);
});

// A full match row as the queries return it - `players` and `tournamentId` are
// what the seeded-first ordering reads (see seeded-match-players.ts).
const fullRow = (id: string) => ({ id, tournamentId: "t1", players: [] });

describe("getPlayerPadelMatches / getPadelTournamentMatches / getRecentCompletedPadelMatches / getAllPadelMatches", () => {
  it("scopes to the given player", async () => {
    await getPlayerPadelMatches("p1");
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("lists a player's matches newest-first by finish time within a day, ignoring the playoff placeholders' staggered scheduledDate", async () => {
    const day = new Date("2026-10-10T00:00:00.000Z");
    const row = (id: string, offsetSeconds: number, completedAt: string) => ({
      ...fullRow(id),
      scheduledDate: new Date(day.getTime() + offsetSeconds * 1000),
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      completedAt: new Date(completedAt),
    });
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([
      row("quarter", 5, "2026-10-10T13:38:00.000Z"),
      row("semi", 3, "2026-10-10T14:37:00.000Z"),
      row("final", 1, "2026-10-10T16:22:00.000Z"),
      row("group-d-2", 0, "2026-10-10T12:06:00.000Z"),
      row("group-d-1", 0, "2026-10-10T10:45:00.000Z"),
    ]);

    const result = await getPlayerPadelMatches("p1");

    expect(result.map((m) => m.id)).toEqual(["final", "semi", "quarter", "group-d-2", "group-d-1"]);
  });

  it("scopes to the given tournament", async () => {
    await getPadelTournamentMatches("t1");
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tournamentId: "t1" } }),
    );
  });

  it("only fetches decided, completed matches for the recent-results feed", async () => {
    await getRecentCompletedPadelMatches(5);
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "COMPLETED", winnerSide: { not: null } } }),
    );
  });

  it("takes the newest `limit` by day then finish time - not by the playoff placeholders' staggered scheduledDate - and loads full rows only for those", async () => {
    const day = new Date("2026-10-10T00:00:00.000Z");
    const key = (id: string, offsetSeconds: number, completedAt: string) => ({
      id,
      scheduledDate: new Date(day.getTime() + offsetSeconds * 1000),
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      completedAt: new Date(completedAt),
    });
    prismaMock.padelMatch.findMany
      .mockResolvedValueOnce([
        key("group", 0, "2026-10-10T10:45:00.000Z"),
        key("quarter", 5, "2026-10-10T13:38:00.000Z"),
        key("semi", 3, "2026-10-10T14:37:00.000Z"),
        key("final", 1, "2026-10-10T16:22:00.000Z"),
      ])
      .mockResolvedValueOnce([fullRow("semi"), fullRow("final")]);

    const result = await getRecentCompletedPadelMatches(2);

    expect(prismaMock.padelMatch.findMany.mock.calls[1][0].where).toEqual({ id: { in: ["final", "semi"] } });
    expect(result.map((m) => m.id)).toEqual(["final", "semi"]);
  });

  it("fetches every match unfiltered", async () => {
    await getAllPadelMatches();
    const [args] = prismaMock.padelMatch.findMany.mock.calls[0];
    expect(args.where).toBeUndefined();
  });
});

describe("seeded player first in a doubles pair", () => {
  const doublesRow = () => ({
    id: "m1",
    tournamentId: "t1",
    players: [
      { side: "A", playerId: "p1" },
      { side: "A", playerId: "p2" },
      { side: "B", playerId: "p3" },
      { side: "B", playerId: "p4" },
    ],
  });
  const orderOf = (match: { players: { side: string; playerId: string }[] }, side: string) =>
    match.players.filter((p) => p.side === side).map((p) => p.playerId);

  beforeEach(() => {
    prismaMock.padelTournamentParticipant.findMany.mockResolvedValue([
      { tournamentId: "t1", playerId: "p2" },
      { tournamentId: "t1", playerId: "p4" },
    ]);
  });

  it("orders getPadelTournamentMatches' pairs, looking seeds up in the Padel roster", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doublesRow()]);

    const [match] = await getPadelTournamentMatches("t1");

    expect(orderOf(match, "A")).toEqual(["p2", "p1"]);
    expect(orderOf(match, "B")).toEqual(["p4", "p3"]);
    expect(prismaMock.padelTournamentParticipant.findMany).toHaveBeenCalledWith({
      where: { tournamentId: { in: ["t1"] }, seed: { not: null } },
      select: { tournamentId: true, playerId: true },
    });
  });

  it("orders getPadelMatchById's pair, and returns null for a missing match", async () => {
    prismaMock.padelMatch.findUnique.mockResolvedValueOnce(doublesRow()).mockResolvedValueOnce(null);

    const match = await getPadelMatchById("m1");
    expect(match && orderOf(match, "A")).toEqual(["p2", "p1"]);
    expect(await getPadelMatchById("missing")).toBeNull();
  });

  it("orders getAllPadelMatches' and getPlayerPadelMatches' pairs too", async () => {
    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doublesRow()]);
    const [all] = await getAllPadelMatches();
    expect(orderOf(all, "A")).toEqual(["p2", "p1"]);

    prismaMock.padelMatch.findMany.mockResolvedValueOnce([doublesRow()]);
    const [mine] = await getPlayerPadelMatches("p1");
    expect(orderOf(mine, "B")).toEqual(["p4", "p3"]);
  });
});

describe("getPadelSeasonMatchCount", () => {
  it("counts decided, non-walkover Padel matches whose tournament started in the given calendar year (UTC)", async () => {
    prismaMock.padelMatch.count.mockResolvedValueOnce(11);
    const result = await getPadelSeasonMatchCount(2026);
    expect(prismaMock.padelMatch.count).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        winnerSide: { not: null },
        walkover: false,
        tournament: {
          startDate: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") },
        },
      },
    });
    expect(result).toBe(11);
  });
});

describe("getPadelMatchesPage", () => {
  it("builds an empty where clause with no filters", async () => {
    await getPadelMatchesPage(20, {});
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("filters by player", async () => {
    await getPadelMatchesPage(20, { playerId: "p1" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { players: { some: { playerId: "p1" } } } }),
    );
  });

  it("filters by status", async () => {
    await getPadelMatchesPage(20, { status: "COMPLETED" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "COMPLETED" } }),
    );
  });

  it("filters by a calendar day using a UTC range, falling back to createdAt for unscheduled matches", async () => {
    await getPadelMatchesPage(20, { date: "2026-03-15" });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              scheduledDate: {
                gte: new Date("2026-03-15T00:00:00.000Z"),
                lt: new Date("2026-03-16T00:00:00.000Z"),
              },
            },
            {
              scheduledDate: null,
              createdAt: {
                gte: new Date("2026-03-15T00:00:00.000Z"),
                lt: new Date("2026-03-16T00:00:00.000Z"),
              },
            },
          ],
        },
      }),
    );
  });

  it("combines every filter together", async () => {
    await getPadelMatchesPage(10, { playerId: "p1", date: "2026-03-15", status: "SCHEDULED" });
    const where = prismaMock.padelMatch.findMany.mock.calls[0][0].where;
    expect(where.players).toEqual({ some: { playerId: "p1" } });
    expect(where.status).toBe("SCHEDULED");
    expect(where.OR).toHaveLength(2);
  });

  it("returns the newest `limit` matches in order, plus the total of everything that matched the filter", async () => {
    const key = (id: string, completedAt: string) => ({
      id,
      scheduledDate: new Date("2026-10-10T00:00:00.000Z"),
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      completedAt: new Date(completedAt),
    });
    prismaMock.padelMatch.findMany
      .mockResolvedValueOnce([
        key("early", "2026-10-10T10:00:00.000Z"),
        key("late", "2026-10-10T16:00:00.000Z"),
        key("mid", "2026-10-10T13:00:00.000Z"),
      ])
      // Fetched in a different order than requested on purpose - the page must follow the sorted ids.
      .mockResolvedValueOnce([fullRow("mid"), fullRow("late")]);

    const result = await getPadelMatchesPage(2, {});

    expect(result).toEqual({ matches: [fullRow("late"), fullRow("mid")], total: 3 });
  });

  it("returns an empty page without a second query when nothing matches", async () => {
    const result = await getPadelMatchesPage(20, { playerId: "nobody" });
    expect(result).toEqual({ matches: [], total: 0 });
    expect(prismaMock.padelMatch.findMany).toHaveBeenCalledTimes(1);
  });
});
