"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { AUDIT_DELETE_ACTION } from "@/lib/audit-actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { countLabel, RECORD_FORMS } from "@/lib/pluralize";

// The audit page shows at most 20 * 100 rows at once (PAGE_SIZE times
// parseShowParam's cap), so "select all" never legitimately sends more.
const MAX_IDS = 2000;

/**
 * Permanently deletes the given audit log entries - superadmin only, same as
 * viewing the log. "audit.delete" entries (the trace of an earlier deletion)
 * are skipped, and this deletion is logged too, so removing entries always
 * leaves a mark. Returns how many entries were actually deleted: ids that no
 * longer exist, or that point at "audit.delete" entries, don't count.
 */
export async function deleteAuditLogEntriesAction(ids: string[]): Promise<number> {
  const session = await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Не вибрано жодного запису");
  }
  if (ids.some((id) => typeof id !== "string" || !id)) {
    throw new Error("Некоректний запис журналу");
  }
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > MAX_IDS) {
    throw new Error(`За раз можна видалити не більше ${MAX_IDS} записів`);
  }

  const { count } = await prisma.auditLog.deleteMany({
    where: { id: { in: uniqueIds }, action: { not: AUDIT_DELETE_ACTION } },
  });

  if (count > 0) {
    after(() => logAudit(session.user, {
      action: AUDIT_DELETE_ACTION,
      entityType: "AuditLog",
      summary: `Видалено ${countLabel(count, RECORD_FORMS)} з журналу`,
    }));
  }

  revalidatePath("/admin/audit");
  return count;
}
