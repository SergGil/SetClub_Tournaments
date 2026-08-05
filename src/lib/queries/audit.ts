import { prisma } from "@/lib/db";
import { TEST_ADMIN_EMAIL } from "@/lib/test-login";

// Excludes the Playwright e2e test admin's entries - not real admin activity,
// just noise from running the test suite. Matched by actorLabel too (not just
// the account relation) so entries survive the account being cleaned up
// between test runs (actorId -> null, but the label snapshot stays "E2E Admin").
const excludeTestAdmin = {
  NOT: { OR: [{ actor: { email: TEST_ADMIN_EMAIL } }, { actorLabel: "E2E Admin" }] },
};

export type AuditLogFilter = { actorLabel?: string; action?: string };

/** The first `limit` audit log entries (newest first, optionally narrowed to one actor/action) plus the total count, for a "load more" list. */
export async function getAuditLogPage(limit: number, filter: AuditLogFilter = {}) {
  const where = {
    ...excludeTestAdmin,
    ...(filter.actorLabel ? { actorLabel: filter.actorLabel } : {}),
    ...(filter.action ? { action: filter.action } : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { entries, total };
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogPage>>["entries"][number];

/** Distinct actor names that have logged entries, for a filter dropdown - a plain findMany against a fixed set of admins, not worth a separate join to User. */
export async function getDistinctAuditActors(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: excludeTestAdmin,
    distinct: ["actorLabel"],
    select: { actorLabel: true },
    orderBy: { actorLabel: "asc" },
  });
  return rows.map((r) => r.actorLabel);
}
