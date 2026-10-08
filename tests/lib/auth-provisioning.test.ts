import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: { deleteMany: vi.fn() },
    player: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/admin-emails", () => ({ getProtectedAdminEmails: () => [] }));
vi.mock("server-only", () => ({}));

import { provisionSignIn, purgeExpiredSessions } from "@/lib/auth-provisioning";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.player.findMany.mockResolvedValue([]);
});

describe("purgeExpiredSessions", () => {
  it("deletes only sessions that already expired", async () => {
    const now = new Date("2026-10-08T12:00:00Z");
    await purgeExpiredSessions(now);
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { expires: { lt: now } } });
  });

  it("never throws - a failed sweep must not block a sign-in", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.session.deleteMany.mockRejectedValueOnce(new Error("db down"));
    await expect(purgeExpiredSessions()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("provisionSignIn", () => {
  it("sweeps expired sessions on every sign-in", async () => {
    await provisionSignIn({ id: "u1", email: "A@b.c" });
    expect(prismaMock.session.deleteMany).toHaveBeenCalledTimes(1);
  });
});
