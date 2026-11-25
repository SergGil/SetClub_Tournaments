import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    auditLog: { findFirst: vi.fn() },
    tournament: { aggregate: vi.fn() },
    match: { aggregate: vi.fn() },
    newsPost: { aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getContentLastUpdatedAt } from "@/lib/queries/home-stats";

function maxUpdatedAt(date: string | null) {
  return { _max: { updatedAt: date ? new Date(date) : null } };
}

function givenData({
  audit,
  tournament = null,
  match = null,
  news = null,
}: {
  audit: string | null;
  tournament?: string | null;
  match?: string | null;
  news?: string | null;
}) {
  prismaMock.auditLog.findFirst.mockResolvedValue(audit ? { createdAt: new Date(audit) } : null);
  prismaMock.tournament.aggregate.mockResolvedValue(maxUpdatedAt(tournament));
  prismaMock.match.aggregate.mockResolvedValue(maxUpdatedAt(match));
  prismaMock.newsPost.aggregate.mockResolvedValue(maxUpdatedAt(news));
}

beforeEach(() => vi.clearAllMocks());

describe("getContentLastUpdatedAt", () => {
  it("moves the date on a deletion - only the audit log remembers it", async () => {
    // e.g. a news post deleted on the 20th; every remaining row is older.
    givenData({ audit: "2026-11-20T10:00:00.000Z", tournament: "2026-11-08T22:37:00.000Z", news: "2026-11-01T09:00:00.000Z" });
    expect(await getContentLastUpdatedAt()).toEqual(new Date("2026-11-20T10:00:00.000Z"));
  });

  it("still counts a write that never reached the audit log", async () => {
    givenData({ audit: "2026-11-05T10:00:00.000Z", match: "2026-11-09T18:00:00.000Z" });
    expect(await getContentLastUpdatedAt()).toEqual(new Date("2026-11-09T18:00:00.000Z"));
  });

  it("reads only the newest audit entry for public tennis content, not padel", async () => {
    givenData({ audit: null, tournament: "2026-11-08T22:37:00.000Z" });
    await getContentLastUpdatedAt();
    expect(prismaMock.auditLog.findFirst).toHaveBeenCalledWith({
      where: { entityType: { in: ["Tournament", "Match", "NewsPost"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  });

  it("is null on an empty database", async () => {
    givenData({ audit: null });
    expect(await getContentLastUpdatedAt()).toBeNull();
  });
});
