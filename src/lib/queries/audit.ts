import { prisma } from "@/lib/db";
import { TEST_ADMIN_EMAIL } from "@/lib/test-login";

// Excludes the Playwright e2e test admin's entries - not real admin activity,
// just noise from running the test suite. Matched by actorLabel too (not just
// the account relation) so entries survive the account being cleaned up
// between test runs (actorId -> null, but the label snapshot stays "E2E Admin").
const excludeTestAdmin = {
  NOT: { OR: [{ actor: { email: TEST_ADMIN_EMAIL } }, { actorLabel: "E2E Admin" }] },
};

/** The first `limit` audit log entries (newest first) plus the total count, for a "load more" list. */
export async function getAuditLogPage(limit: number) {
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: excludeTestAdmin,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.auditLog.count({ where: excludeTestAdmin }),
  ]);
  return { entries, total };
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogPage>>["entries"][number];
