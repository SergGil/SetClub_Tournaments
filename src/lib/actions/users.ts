"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";

const roleValues = ["ADMIN", "MEMBER"] as const;

export async function updateUserRoleAction(userId: string, role: string): Promise<void> {
  const session = await requireAdmin();

  if (!roleValues.includes(role as (typeof roleValues)[number])) {
    throw new Error("Invalid role");
  }
  if (userId === session.user.id) {
    throw new Error("Не можна змінити власну роль");
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as "ADMIN" | "MEMBER" },
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new Error("Користувача не знайдено — можливо, його вже видалили");
    }
    throw error;
  }

  after(() => logAudit(session.user, {
    action: "user.role",
    entityType: "User",
    entityId: userId,
    summary: `Змінено роль користувача "${updated.name ?? updated.email}" на ${role}`,
  }));

  revalidatePath("/admin/users");
}
