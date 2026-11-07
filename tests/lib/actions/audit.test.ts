import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "SUPERADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { auditLog: { deleteMany: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { deleteAuditLogEntriesAction } from "@/lib/actions/audit";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 0 });
});

describe("deleteAuditLogEntriesAction", () => {
  it("refuses anyone who isn't a superadmin, before touching the log", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Forbidden: admin access required"));
    await expect(deleteAuditLogEntriesAction(["a1"])).rejects.toThrow("Forbidden");
    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects an empty selection", async () => {
    await expect(deleteAuditLogEntriesAction([])).rejects.toThrow("Не вибрано жодного запису");
    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a non-array or non-string ids (a hand-crafted action call)", async () => {
    await expect(deleteAuditLogEntriesAction("a1" as unknown as string[])).rejects.toThrow();
    await expect(deleteAuditLogEntriesAction([1 as unknown as string])).rejects.toThrow("Некоректний");
    await expect(deleteAuditLogEntriesAction([""])).rejects.toThrow("Некоректний");
    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects more ids than the page can ever show at once", async () => {
    const ids = Array.from({ length: 2001 }, (_, i) => `a${i}`);
    await expect(deleteAuditLogEntriesAction(ids)).rejects.toThrow("не більше 2000");
    expect(prismaMock.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the deduplicated ids and returns the actual count", async () => {
    prismaMock.auditLog.deleteMany.mockResolvedValueOnce({ count: 2 });
    const count = await deleteAuditLogEntriesAction(["a1", "a2", "a1"]);

    expect(count).toBe(2);
    expect(prismaMock.auditLog.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a1", "a2"] } } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/audit");
  });

  it("leaves no trace of the deletion in the log", async () => {
    prismaMock.auditLog.deleteMany.mockResolvedValueOnce({ count: 3 });
    await deleteAuditLogEntriesAction(["a1", "a2", "a3"]);

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});
