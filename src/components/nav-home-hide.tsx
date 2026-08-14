"use client";

import { usePathname } from "next/navigation";

/**
 * `/` (the triple-split homepage, docs/HOMEPAGE.md) and `/admin/*` are both
 * "generic" pages that don't belong to any one sport section - `/admin` is
 * shared across every domain's admins, and already has its own in-context
 * navigation scoped to whichever domains the signed-in admin actually holds
 * (AdminNav, admin-nav.tsx). Falling through to useSectionLinks' Tennis
 * default set there (nav-links.tsx) would wrongly make a Coffee- or
 * Padel-only admin look like they'd landed in the Tennis section the moment
 * they open the admin panel.
 */
function isGenericPage(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/admin");
}

/**
 * The tennis nav menu only makes sense once you're inside an actual sport
 * section, so it's hidden on `/` and `/admin/*` (see isGenericPage) and
 * shown everywhere else (incl. /tennis and its sub-pages).
 */
export function HideOnHome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isGenericPage(pathname)) return null;
  return <>{children}</>;
}

/**
 * Same idea, but also covers /coffee and /padel - the court-photo background
 * toggle is Tennis-specific and doesn't belong in the Coffee or Padel hubs
 * either, unlike the nav links themselves (which stay visible there, just
 * swapped for COFFEE_NAV_LINKS/PADEL_NAV_LINKS - see NavLinksInline/
 * NavLinksDropdownItems). Padel gets its own separate toggle instead - see
 * ShowOnPadelIfAuthorized below.
 */
export function HideOnHubPages({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isGenericPage(pathname) || pathname.startsWith("/coffee") || pathname.startsWith("/padel")) return null;
  return <>{children}</>;
}

/**
 * The Padel background toggle only makes sense on /padel itself, and only
 * for whoever can actually see the Padel section at all right now
 * (superadmin or a PADEL-domain admin - see hasPadelAdminAccess in nav.tsx).
 * `authorized` is resolved server-side once in Nav and threaded down here as
 * a prop since this component only needs the *route* check client-side.
 */
export function ShowOnPadelIfAuthorized({
  authorized,
  children,
}: {
  authorized: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!authorized || !pathname.startsWith("/padel")) return null;
  return <>{children}</>;
}

/**
 * HideOnHome above hides the entire Tennis nav link list on `/` and
 * `/admin/*` (see isGenericPage) - but "Адмін-панель" shouldn't need a
 * detour through /tennis or /coffee first just to reach it, and while
 * already inside /admin it doubles as a quick way back to the admin root
 * from any deep admin sub-page. Any admin (superadmin or a domain admin -
 * `authorized` is hasAdminAccess from nav.tsx) gets this standalone link
 * regardless.
 */
export function ShowOnHomeIfAuthorized({
  authorized,
  children,
}: {
  authorized: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!authorized || !isGenericPage(pathname)) return null;
  return <>{children}</>;
}
