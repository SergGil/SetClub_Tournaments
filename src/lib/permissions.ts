import "server-only";

import { auth } from "@/lib/auth";
import type { AdminDomain } from "@/generated/prisma/enums";

export async function getSession() {
  return auth();
}

export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

/** Throws if the current user is not an admin. Use at the top of admin-only server actions. */
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

/**
 * Superadmin (Role.ADMIN) or a scoped domain admin for `domain` - see
 * docs/ADMIN_DOMAINS.md. Use for anything that today is "Tennis admin"
 * territory (tournaments, matches, players, news) so a TENNIS-domain admin
 * can manage it without full superadmin rights.
 */
export async function isDomainAdmin(domain: AdminDomain) {
  const session = await auth();
  if (!session?.user) return false;
  return session.user.role === "ADMIN" || session.user.domains.includes(domain);
}

/** Throws unless the current user is a superadmin or a `domain` admin. */
export async function requireDomainAdmin(domain: AdminDomain) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && !session.user.domains.includes(domain))) {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

/** Superadmin or admin of at least one domain - the bar for entering `/admin` at all. */
export async function hasAnyAdminAccess() {
  const session = await auth();
  if (!session?.user) return false;
  return session.user.role === "ADMIN" || session.user.domains.length > 0;
}

/** Throws if there is no signed-in user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: sign-in required");
  }
  return session;
}
