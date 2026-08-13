"use client";

import { usePathname } from "next/navigation";

/**
 * The triple-split homepage (docs/HOMEPAGE.md) is a hub for Tennis/Coffee/Padel,
 * not tennis-specific - the tennis nav menu and the court-photo background
 * toggle only make sense once you're inside the Tennis section, so they're
 * hidden on `/` and shown everywhere else (incl. /tennis and its sub-pages).
 */
export function HideOnHome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
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
  if (pathname === "/" || pathname.startsWith("/coffee") || pathname.startsWith("/padel")) return null;
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
