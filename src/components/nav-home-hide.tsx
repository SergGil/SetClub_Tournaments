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
