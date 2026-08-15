"use client";

import { WallpaperIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setBackgroundPhoto(storageKey: string, htmlClass: string, next: boolean) {
  document.documentElement.classList.toggle(htmlClass, next);
  try {
    localStorage.setItem(storageKey, next ? "1" : "0");
  } catch {
    // Storage blocked (private mode, etc.) - the toggle still works for this page load.
  }
  listeners.forEach((listener) => listener());
}

// The server can't know the stored preference, so it renders "off" - matching
// what the anti-flash script in layout.tsx defaults to before localStorage is checked.
function getServerSnapshot() {
  return false;
}

/**
 * A background-photo toggle scoped to one `htmlClass`/`storageKey` pair -
 * used twice (Tennis's court photo, Padel's own court photo, see nav.tsx),
 * each independent of the other's stored preference and each only shown in
 * its own section (see HideOnHubPages/ShowOnPadelIfAuthorized).
 */
export function BackgroundToggle({
  storageKey,
  htmlClass,
  label,
}: {
  storageKey: string;
  htmlClass: string;
  label: string;
}) {
  // Reads straight off <html>, which the inline anti-flash script in
  // layout.tsx already set from localStorage before hydration - no extra
  // effect needed.
  const checked = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains(htmlClass),
    getServerSnapshot,
  );

  return (
    <label
      className="flex min-h-11 min-w-11 items-center justify-center gap-1.5"
      title={label}
    >
      <WallpaperIcon className="size-4 text-muted-foreground" />
      <Switch
        checked={checked}
        onCheckedChange={(next) => setBackgroundPhoto(storageKey, htmlClass, next)}
        aria-label={label}
      />
    </label>
  );
}
