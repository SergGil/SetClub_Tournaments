"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const CLASSES = {
  coffee: "coffee-route",
  padel: "padel-route",
} as const;

/**
 * Same `?hub=coffee`/`?hub=padel` marker useSectionLinks (nav-links.tsx)
 * reads - /news and /gallery are club-wide pages that don't sit under a
 * /coffee or /padel path, so a plain prefix check would miss them and this
 * guard would stamp neither route class, letting the Tennis background
 * photo rule in globals.css win by default.
 */
function useSection(): "coffee" | "padel" | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname.startsWith("/coffee")) return "coffee";
  if (pathname.startsWith("/padel")) return "padel";
  const hub = searchParams.get("hub");
  if (hub === "coffee") return "coffee";
  if (hub === "padel") return "padel";
  return null;
}

/**
 * Each background-photo toggle (background-toggle.tsx) is a global
 * localStorage preference, not scoped to its own section - so a visitor who
 * turned the Tennis court photo on while browsing /tennis would still see it
 * behind /coffee or /padel, and vice versa for the Padel court photo. Stamps
 * `coffee-route`/`padel-route` on <html> while on the matching path so
 * globals.css can gate each photo to its own section without touching the
 * stored preferences (they reapply the moment the visitor navigates back).
 */
function SectionRouteGuardContent() {
  const section = useSection();
  const onCoffee = section === "coffee";
  const onPadel = section === "padel";

  useEffect(() => {
    document.documentElement.classList.toggle(CLASSES.coffee, onCoffee);
    document.documentElement.classList.toggle(CLASSES.padel, onPadel);
    return () => {
      document.documentElement.classList.remove(CLASSES.coffee, CLASSES.padel);
    };
  }, [onCoffee, onPadel]);

  return null;
}

/** Suspense-wrapped for the same reason as NavLinksInline (nav-links.tsx): useSearchParams requires a Suspense boundary around it. */
export function SectionRouteGuard() {
  return (
    <Suspense fallback={null}>
      <SectionRouteGuardContent />
    </Suspense>
  );
}
