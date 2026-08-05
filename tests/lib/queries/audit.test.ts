import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { auditLog: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getAuditLogPage, getDistinctAuditActors } from "@/lib/queries/audit";

const excludeTestAdmin = {
  NOT: { OR: [{ actor: { email: "e2e-admin@test.local" } }, { actorLabel: "E2E Admin" }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.findMany.mockResolvedValue([]);
  prismaMock.auditLog.count.mockResolvedValue(0);
});

describe("getAuditLogPage", () => {
  it("always excludes the e2e test admin's own entries", async () => {
    await getAuditLogPage(20);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: excludeTestAdmin }),
    );
    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({ where: excludeTestAdmin });
  });

  it("adds actor/action filters on top of the exclusion", async () => {
    await getAuditLogPage(20, { actorLabel: "Admin", action: "match.create" });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...excludeTestAdmin, actorLabel: "Admin", action: "match.create" },
      }),
    );
  });

  it("returns both the page and the total count", async () => {
    prismaMock.auditLog.findMany.mockResolvedValueOnce([{ id: "a1" }]);
    prismaMock.auditLog.count.mockResolvedValueOnce(3);
    const result = await getAuditLogPage(1);
    expect(result).toEqual({ entries: [{ id: "a1" }], total: 3 });
  });
});

describe("getDistinctAuditActors", () => {
  it("excludes the test admin and returns just the labels", async () => {
    prismaMock.auditLog.findMany.mockResolvedValueOnce([{ actorLabel: "Admin" }, { actorLabel: "Coach" }]);
    const result = await getDistinctAuditActors();
    expect(result).toEqual(["Admin", "Coach"]);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: excludeTestAdmin, distinct: ["actorLabel"] }),
    );
  });
});
