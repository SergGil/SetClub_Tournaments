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
 * Same idea, but also covers /coffee - the court-photo background toggle is
 * Tennis-specific and doesn't belong in the Coffee hub either, unlike the
 * nav links themselves (which stay visible on /coffee, just swapped for
 * COFFEE_NAV_LINKS - see NavLinksInline/NavLinksDropdownItems).
 */
export function HideOnHomeOrCoffee({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/coffee")) return null;
  return <>{children}</>;
}
