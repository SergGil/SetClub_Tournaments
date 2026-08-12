"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import type { AdminDomain } from "@/generated/prisma/enums";
import { isProtectedAdminEmail } from "@/lib/admin-emails";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { isRecordNotFoundError } from "@/lib/prisma-errors";

const roleValues = ["ADMIN", "MEMBER"] as const;
const domainValues = ["TENNIS", "COFFEE", "PADEL"] as const;

const DOMAIN_LABEL: Record<AdminDomain, string> = {
  TENNIS: "Теніс",
  COFFEE: "Кава",
  PADEL: "Падел",
};

/** Assigns exactly the given set of scoped admin domains to a user (replaces whatever they had). */
export async function updateUserDomainsAction(userId: string, domains: string[]): Promise<void> {
  const session = await requireAdmin();

  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.some((d) => !domainValues.includes(d as (typeof domainValues)[number]))) {
    throw new Error("Invalid domain");
  }
  const validDomains = uniqueDomains as AdminDomain[];

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!target) {
    throw new Error("Користувача не знайдено — можливо, його вже видалили");
  }

  await prisma.$transaction([
    prisma.userAdminDomain.deleteMany({ where: { userId } }),
    ...(validDomains.length > 0
      ? [prisma.userAdminDomain.createMany({ data: validDomains.map((domain) => ({ userId, domain })) })]
      : []),
  ]);

  const summary =
    validDomains.length > 0
      ? `Адмін-розділи "${target.name ?? target.email}": ${validDomains.map((d) => DOMAIN_LABEL[d]).join(", ")}`
      : `Адмін-розділи "${target.name ?? target.email}" очищено`;

  after(() => logAudit(session.user, {
    action: "user.domains",
    entityType: "User",
    entityId: userId,
    summary,
  }));

  revalidatePath("/admin/users");
}

export async function updateUserRoleAction(userId: string, role: string): Promise<void> {
  const session = await requireAdmin();

  if (!roleValues.includes(role as (typeof roleValues)[number])) {
    throw new Error("Invalid role");
  }
  if (userId === session.user.id) {
    throw new Error("Не можна змінити власну роль");
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) {
    throw new Error("Користувача не знайдено — можливо, його вже видалили");
  }
  // ADMIN_EMAILS-listed users are the permanent "super admin" list - no other
  // admin can demote (or otherwise change the role of) one, even by racing
  // this check via a direct action call.
  if (isProtectedAdminEmail(target.email)) {
    throw new Error("Не можна змінити роль суперадміна");
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
