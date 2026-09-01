import "server-only";

import { auth } from "@/lib/auth";
import type { AdminDomain } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * Every guard below optionally takes the incoming `Request` so API route
 * handlers (src/app/api/v1/**) can authenticate mobile clients via
 * `Authorization: Bearer <sessionToken>` instead of the `authjs.session-token`
 * cookie `auth()` reads. Web call sites (Server Actions, pages) keep calling
 * these with no `request` argument and get the exact same cookie-based
 * behavior as before - this only adds a second lookup path, it doesn't
 * change the first one.
 */
async function resolveSession(request?: Request) {
  const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return auth();

  const session = await prisma.session.findUnique({ where: { sessionToken: token }, include: { user: true } });
  if (!session || session.expires < new Date()) return null;

  const domainRows = await prisma.userAdminDomain.findMany({
    where: { userId: session.userId },
    select: { domain: true },
  });
  return { user: { ...session.user, domains: domainRows.map((row) => row.domain) } };
}

export async function getSession(request?: Request) {
  return resolveSession(request);
}

// Role tiers (docs/ADMIN_DOMAINS.md): SUPERADMIN has full access everywhere,
// always. ADMIN is only meaningful together with UserAdminDomain rows -
// picks which of Кава/Теніс/Падел they manage; an ADMIN with zero domain
// rows can do nothing. MEMBER has no admin access. isAdmin()/requireAdmin()
// below check SUPERADMIN specifically - kept under their original name since
// they've always meant "the one true admin tier," which is what SUPERADMIN
// is now.

export async function isAdmin(request?: Request) {
  const session = await resolveSession(request);
  return session?.user?.role === "SUPERADMIN";
}

/** Throws if the current user is not a superadmin. Use for anything that spans every domain (user/domain management, the full audit log). */
export async function requireAdmin(request?: Request) {
  const session = await resolveSession(request);
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
export async function isDomainAdmin(domain: AdminDomain, request?: Request) {
  const session = await resolveSession(request);
  if (!session?.user) return false;
  if (session.user.role === "SUPERADMIN") return true;
  return session.user.role === "ADMIN" && session.user.domains.includes(domain);
}

/** Throws unless the current user is a superadmin or a `domain` admin. */
export async function requireDomainAdmin(domain: AdminDomain, request?: Request) {
  const session = await resolveSession(request);
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
 * Superadmin, or an ADMIN-role user holding at least one of `domains` - for
 * a section shared by some (not all) domains, e.g. Players, managed by both
 * Tennis and Padel admins since they share the same Player table.
 */
export async function isDomainsAdmin(domains: AdminDomain[], request?: Request) {
  const session = await resolveSession(request);
  if (!session?.user) return false;
  if (session.user.role === "SUPERADMIN") return true;
  return session.user.role === "ADMIN" && domains.some((d) => session.user.domains.includes(d));
}

/** Throws unless the current user is a superadmin or an ADMIN holding at least one of `domains`. */
export async function requireDomainsAdmin(domains: AdminDomain[], request?: Request) {
  const session = await resolveSession(request);
  const allowed =
    !!session?.user &&
    (session.user.role === "SUPERADMIN" ||
      (session.user.role === "ADMIN" && domains.some((d) => session.user.domains.includes(d))));
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
export async function hasAnyAdminAccess(request?: Request) {
  const { isSuperAdmin, domains } = getAdminScope(await resolveSession(request));
  return isSuperAdmin || domains.length > 0;
}

/** Throws unless the current user is a superadmin or an ADMIN with at least one domain. Use for News, the one section shared across every domain rather than gated to a single one. */
export async function requireAnyDomainAdmin(request?: Request) {
  const session = await resolveSession(request);
  const { isSuperAdmin, domains } = getAdminScope(session);
  if (!isSuperAdmin && domains.length === 0) {
    throw new Error("Forbidden: admin access required");
  }
  return session!;
}

/** Throws if there is no signed-in user. */
export async function requireUser(request?: Request) {
  const session = await resolveSession(request);
  if (!session?.user) {
    throw new Error("Unauthorized: sign-in required");
  }
  return session;
}
