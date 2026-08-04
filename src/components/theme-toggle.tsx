"use client";

import { MoonIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "setclub:theme";
const HTML_CLASS = "dark";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Reads straight off <html>, which the inline anti-flash script in layout.tsx
// already set from localStorage before hydration - no extra effect needed.
function getSnapshot() {
  return document.documentElement.classList.contains(HTML_CLASS);
}

// The server can't know the stored preference, so it renders "off" - matching
// what the anti-flash script defaults to before localStorage is checked.
function getServerSnapshot() {
  return false;
}

function setDarkTheme(next: boolean) {
  document.documentElement.classList.toggle(HTML_CLASS, next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // Storage blocked (private mode, etc.) - the toggle still works for this page load.
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const checked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <label className="flex items-center gap-1.5" title="Темна тема">
      <MoonIcon className="size-4 text-muted-foreground" />
      <Switch checked={checked} onCheckedChange={setDarkTheme} aria-label="Темна тема" />
    </label>
  );
}
