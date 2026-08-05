import type { AuditAction } from "@/lib/audit-actions";
import { prisma } from "@/lib/db";

export { AUDIT_ACTIONS, AUDIT_ACTION_LABEL } from "@/lib/audit-actions";
export type { AuditAction } from "@/lib/audit-actions";

type Actor = { id: string; name?: string | null; email?: string | null };

/**
 * Records one admin mutation. Best-effort: a logging failure shouldn't take
 * down the mutation it's describing, so errors are swallowed (and printed)
 * rather than propagated - the action that already succeeded still returns
 * normally to the user.
 */
export async function logAudit(
  actor: Actor,
  entry: { action: AuditAction; entityType: string; entityId?: string; summary: string },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorLabel: actor.name ?? actor.email ?? "Невідомий",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log entry", entry, error);
  }
}
