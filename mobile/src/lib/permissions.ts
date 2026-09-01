import type { StoredUser } from '@/lib/session-storage';

/** Client-side mirror of src/lib/permissions.ts::isDomainAdmin - gates which admin buttons render, same tiers as docs/ADMIN_DOMAINS.md (the server still re-checks on every write, this only controls UI visibility). */
export function isDomainAdmin(user: StoredUser | null | undefined, domain: 'TENNIS' | 'COFFEE' | 'PADEL'): boolean {
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;
  return user.role === 'ADMIN' && user.domains.includes(domain);
}

/** Client-side mirror of hasAnyAdminAccess - superadmin, or an ADMIN with at least one domain. Gates News, shared across every domain rather than scoped to one. */
export function hasAnyAdminAccess(user: StoredUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'SUPERADMIN' || (user.role === 'ADMIN' && user.domains.length > 0);
}

/** Client-side mirror of isAdmin - SUPERADMIN specifically (user/role management, full audit log). */
export function isSuperAdmin(user: StoredUser | null | undefined): boolean {
  return user?.role === 'SUPERADMIN';
}
