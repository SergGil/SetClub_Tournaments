"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const HTML_CLASS = "coffee-route";

/**
 * The court-photo background (background-toggle.tsx) is a global
 * localStorage preference, not scoped to Tennis pages - so a visitor who
 * turned it on while browsing /tennis would still see the court photo
 * behind /coffee. Stamps `coffee-route` on <html> while on /coffee so
 * globals.css can force the photo off there without touching the stored
 * preference (it reapplies the moment they navigate away).
 */
export function CoffeeBackgroundPhotoGuard() {
  const pathname = usePathname();
  const onCoffee = pathname.startsWith("/coffee");

  useEffect(() => {
    document.documentElement.classList.toggle(HTML_CLASS, onCoffee);
    return () => {
      document.documentElement.classList.remove(HTML_CLASS);
    };
  }, [onCoffee]);

  return null;
}
