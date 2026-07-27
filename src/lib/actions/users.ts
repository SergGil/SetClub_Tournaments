"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

const roleValues = ["ADMIN", "MEMBER"] as const;

export async function updateUserRoleAction(userId: string, role: string): Promise<void> {
  const session = await requireAdmin();

  if (!roleValues.includes(role as (typeof roleValues)[number])) {
    throw new Error("Invalid role");
  }
  if (userId === session.user.id) {
    throw new Error("Не можна змінити власну роль");
  }

  await prisma.user.update({ where: { id: userId }, data: { role: role as "ADMIN" | "MEMBER" } });
  revalidatePath("/admin/users");
}
