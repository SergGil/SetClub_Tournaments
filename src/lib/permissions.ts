import "server-only";

import { auth } from "@/lib/auth";
import type { AdminDomain } from "@/generated/prisma/enums";

export async function getSession() {
  return auth();
}

// Role tiers (docs/ADMIN_DOMAINS.md): SUPERADMIN has full access everywhere,
// always. ADMIN is only meaningful together with UserAdminDomain rows -
// picks which of Кава/Теніс/Падел they manage; an ADMIN with zero domain
// rows can do nothing. MEMBER has no admin access. isAdmin()/requireAdmin()
// below check SUPERADMIN specifically - kept under their original name since
// they've always meant "the one true admin tier," which is what SUPERADMIN
// is now.

export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "SUPERADMIN";
}

/** Throws if the current user is not a superadmin. Use for anything that spans every domain (user/domain management, the full audit log). */
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

/**
 * Superadmin, or an ADMIN-role user holding the `domain` scope - see
 * docs/ADMIN_DOMAINS.md. Use for anything that today is "Tennis admin"
 * territory (tournaments, matches, players, news) so a TENNIS-domain admin
 * can manage it without full superadmin rights.
 */
export async function isDomainAdmin(domain: AdminDomain) {
  const session = await auth();
  if (!session?.user) return false;
  if (session.user.role === "SUPERADMIN") return true;
  return session.user.role === "ADMIN" && session.user.domains.includes(domain);
}

/** Throws unless the current user is a superadmin or a `domain` admin. */
export async function requireDomainAdmin(domain: AdminDomain) {
  const session = await auth();
  const allowed =
    !!session?.user &&
    (session.user.role === "SUPERADMIN" ||
      (session.user.role === "ADMIN" && session.user.domains.includes(domain)));
  if (!allowed) {
    throw new Error("Forbidden: admin access required");
  }
  return session!;
}

/**
 * Boils a session down to the two things every admin-gated page/nav needs:
 * whether they're a superadmin, and which domains actually count (domain
 * rows on anyone but an ADMIN are inert - see docs/ADMIN_DOMAINS.md). Kept
 * as one function so the three places that need this (AdminLayout, the
 * `/admin` overview, and the site Nav's "Адмін-панель" link/badge) can't
 * drift out of sync with each other.
 */
export function getAdminScope(
  session: { user?: { role: string; domains: AdminDomain[] } | null } | null | undefined,
): { isSuperAdmin: boolean; domains: AdminDomain[] } {
  const user = session?.user;
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const domains = user?.role === "ADMIN" ? user.domains : [];
  return { isSuperAdmin, domains };
}

/** Superadmin, or an ADMIN with at least one domain - the bar for entering `/admin` at all. */
export async function hasAnyAdminAccess() {
  const { isSuperAdmin, domains } = getAdminScope(await auth());
  return isSuperAdmin || domains.length > 0;
}

/** Throws if there is no signed-in user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: sign-in required");
  }
  return session;
}
