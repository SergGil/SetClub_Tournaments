import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { player: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getLinkedUserIds,
  getPlayerById,
  getPlayerByUserId,
  getPlayers,
  getPlayersPage,
} from "@/lib/queries/players";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPlayers", () => {
  it("sorts alphabetically using Ukrainian collation, not raw code-point order", async () => {
    // Raw JS/Postgres default order would put "Ірина" before "Андрій" (Cyrillic
    // "І" sits at a lower code point than "А") - a Ukrainian speaker expects the
    // opposite, dictionary order.
    prismaMock.player.findMany.mockResolvedValueOnce([
      { name: "Ірина" },
      { name: "Андрій" },
      { name: "Борис" },
    ]);
    const result = await getPlayers();
    expect(result.map((p) => p.name)).toEqual(["Андрій", "Борис", "Ірина"]);
  });
});

describe("getLinkedUserIds", () => {
  it("returns the set of every already-linked userId", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([{ userId: "u1" }, { userId: "u2" }]);
    const result = await getLinkedUserIds();
    expect(result).toEqual(new Set(["u1", "u2"]));
    expect(prismaMock.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { not: null } } }),
    );
  });
});

describe("getPlayersPage", () => {
  it("builds an empty where clause with no query", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([]);
    prismaMock.player.count.mockResolvedValueOnce(0);
    await getPlayersPage(20);
    expect(prismaMock.player.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("searches by name, own email, and linked-account email", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([]);
    prismaMock.player.count.mockResolvedValueOnce(0);
    await getPlayersPage(20, "iva");
    const where = prismaMock.player.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: "iva", mode: "insensitive" } },
      { email: { contains: "iva", mode: "insensitive" } },
      { user: { email: { contains: "iva", mode: "insensitive" } } },
    ]);
  });

  it("sorts in JS, then slices to the page limit (not a DB-level take)", async () => {
    prismaMock.player.findMany.mockResolvedValueOnce([
      { name: "Ірина" },
      { name: "Андрій" },
      { name: "Борис" },
    ]);
    prismaMock.player.count.mockResolvedValueOnce(3);
    const result = await getPlayersPage(2);
    expect(result.players.map((p) => p.name)).toEqual(["Андрій", "Борис"]);
    expect(result.total).toBe(3);
    expect(prismaMock.player.findMany.mock.calls[0][0].take).toBeUndefined();
  });
});

describe("getPlayerById / getPlayerByUserId", () => {
  it("looks up by player id", async () => {
    await getPlayerById("p1");
    expect(prismaMock.player.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" } }));
  });

  it("looks up by linked user id", async () => {
    await getPlayerByUserId("u1");
    expect(prismaMock.player.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } }),
    );
  });
});
