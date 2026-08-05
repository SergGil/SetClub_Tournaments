import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { user: { update: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { updateUserRoleAction } from "@/lib/actions/users";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
});

describe("updateUserRoleAction", () => {
  it("rejects an unrecognized role", async () => {
    await expect(updateUserRoleAction("u1", "SUPERADMIN")).rejects.toThrow("Invalid role");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses to let an admin change their own role", async () => {
    await expect(updateUserRoleAction("admin-1", "MEMBER")).rejects.toThrow("Не можна змінити власну роль");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the user was deleted concurrently", async () => {
    prismaMock.user.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(updateUserRoleAction("u1", "ADMIN")).rejects.toThrow("вже видалили");
  });

  it("updates the role and logs it on success", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserRoleAction("u1", "ADMIN");
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "ADMIN" } });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "user.role" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });
});
