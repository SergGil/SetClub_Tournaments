"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

// The audit page shows at most 20 * 100 rows at once (PAGE_SIZE times
// parseShowParam's cap), so "select all" never legitimately sends more.
const MAX_IDS = 2000;

/**
 * Permanently deletes the given audit log entries - superadmin only, same as
 * viewing the log. Deliberately leaves no trace of its own: the deletion is
 * not written back into the log (the club owner asked for exactly that).
 * Returns how many entries were actually deleted - ids that no longer exist
 * don't count.
 */
export async function deleteAuditLogEntriesAction(ids: string[]): Promise<number> {
  await requireAdmin();

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

  const { count } = await prisma.auditLog.deleteMany({ where: { id: { in: uniqueIds } } });

  revalidatePath("/admin/audit");
  return count;
}
