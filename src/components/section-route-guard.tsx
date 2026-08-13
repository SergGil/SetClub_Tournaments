"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const CLASSES = {
  coffee: "coffee-route",
  padel: "padel-route",
} as const;

/**
 * Each background-photo toggle (background-toggle.tsx) is a global
 * localStorage preference, not scoped to its own section - so a visitor who
 * turned the Tennis court photo on while browsing /tennis would still see it
 * behind /coffee or /padel, and vice versa for the Padel court photo. Stamps
 * `coffee-route`/`padel-route` on <html> while on the matching path so
 * globals.css can gate each photo to its own section without touching the
 * stored preferences (they reapply the moment the visitor navigates back).
 */
export function SectionRouteGuard() {
  const pathname = usePathname();
  const onCoffee = pathname.startsWith("/coffee");
  const onPadel = pathname.startsWith("/padel");

  useEffect(() => {
    document.documentElement.classList.toggle(CLASSES.coffee, onCoffee);
    document.documentElement.classList.toggle(CLASSES.padel, onPadel);
    return () => {
      document.documentElement.classList.remove(CLASSES.coffee, CLASSES.padel);
    };
  }, [onCoffee, onPadel]);

  return null;
}
