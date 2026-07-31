import { prisma } from "@/lib/db";

/** The first `limit` audit log entries (newest first) plus the total count, for a "load more" list. */
export async function getAuditLogPage(limit: number) {
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    prisma.auditLog.count(),
  ]);
  return { entries, total };
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogPage>>["entries"][number];
