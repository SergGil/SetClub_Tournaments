import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } };

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireAdmin: requireAdminMock }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { update: vi.fn(), findUnique: vi.fn() },
    userAdminDomain: { deleteMany: vi.fn(), createMany: vi.fn() },
    // Matches real Prisma semantics closely enough for these tests: awaits
    // every operation in the batch and propagates the first rejection -
    // unlike a naive `async (ops) => ops`, which would return an array of
    // still-pending/rejected promises without ever awaiting or surfacing them.
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const { isProtectedAdminEmailMock } = vi.hoisted(() => ({ isProtectedAdminEmailMock: vi.fn() }));
vi.mock("@/lib/admin-emails", () => ({ isProtectedAdminEmail: isProtectedAdminEmailMock }));

const { logAuditMock } = vi.hoisted(() => ({ logAuditMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("next/server", () => ({ after: vi.fn((task: () => unknown) => task()) }));

import { updateUserDomainsAction, updateUserRoleAction } from "@/lib/actions/users";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(session);
  prismaMock.user.findUnique.mockResolvedValue({ email: "ivan@test.com" });
  isProtectedAdminEmailMock.mockReturnValue(false);
});

describe("updateUserRoleAction", () => {
  it("rejects an unrecognized role", async () => {
    await expect(updateUserRoleAction("u1", "OWNER")).rejects.toThrow("Invalid role");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("accepts SUPERADMIN as a valid role", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserRoleAction("u1", "SUPERADMIN");
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { role: "SUPERADMIN" },
    });
  });

  it("refuses to let an admin change their own role", async () => {
    await expect(updateUserRoleAction("admin-1", "MEMBER")).rejects.toThrow("Не можна змінити власну роль");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the target user was deleted concurrently (found first, then update races)", async () => {
    prismaMock.user.update.mockRejectedValueOnce({ code: "P2025" });
    await expect(updateUserRoleAction("u1", "ADMIN")).rejects.toThrow("вже видалили");
  });

  it("surfaces a friendly error when the target user no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(updateUserRoleAction("u1", "ADMIN")).rejects.toThrow("вже видалили");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses to change the role of a protected (super admin) user", async () => {
    isProtectedAdminEmailMock.mockReturnValue(true);
    await expect(updateUserRoleAction("u1", "MEMBER")).rejects.toThrow(
      "Не можна змінити роль суперадміна",
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("updates the role and logs it on success", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserRoleAction("u1", "ADMIN");
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "ADMIN" } });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "user.role" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });

  it("clears any domain rows when demoting to MEMBER, so they can't silently reactivate on a future re-promotion", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserRoleAction("u1", "MEMBER");
    expect(prismaMock.userAdminDomain.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("does not touch domain rows when the new role is ADMIN or SUPERADMIN", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserRoleAction("u1", "ADMIN");
    expect(prismaMock.userAdminDomain.deleteMany).not.toHaveBeenCalled();
  });
});

describe("updateUserDomainsAction", () => {
  it("rejects an unrecognized domain", async () => {
    await expect(updateUserDomainsAction("u1", ["MARS"])).rejects.toThrow("Invalid domain");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the target user no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(updateUserDomainsAction("u1", ["TENNIS"])).rejects.toThrow("вже видалили");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("de-duplicates the requested domains and replaces the full set", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserDomainsAction("u1", ["TENNIS", "TENNIS", "COFFEE"]);

    expect(prismaMock.userAdminDomain.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prismaMock.userAdminDomain.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", domain: "TENNIS" },
        { userId: "u1", domain: "COFFEE" },
      ],
    });
    expect(logAuditMock).toHaveBeenCalledWith(session.user, expect.objectContaining({ action: "user.domains" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });

  it("clears domains without calling createMany when given an empty set", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ name: "Іван", email: "ivan@test.com" });
    await updateUserDomainsAction("u1", []);

    expect(prismaMock.userAdminDomain.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prismaMock.userAdminDomain.createMany).not.toHaveBeenCalled();
  });
});
