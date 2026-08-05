"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * A debounced `?q=` search box: typing updates the URL (and re-runs the
 * server query) after a short pause rather than on every keystroke, and uses
 * router.replace so partial queries don't pile up in browser history.
 *
 * Only touches the `q` param - reads the rest of the current search params
 * and carries them through unchanged, so a page that also has e.g. `?sort=`
 * isn't silently reset to its default sort the moment this mounts. Also
 * skips navigating at all when the typed value hasn't actually diverged from
 * `defaultValue` (covers the mount-time run of this effect, which otherwise
 * fired an unconditional no-op `router.replace(pathname)` on every page that
 * uses this - harmless by itself, but that call drops every OTHER param too).
 */
export function SearchInput({
  placeholder,
  defaultValue,
}: {
  placeholder: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === (defaultValue ?? "").trim()) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run the debounce on value changes, not on every router/pathname/searchParams identity change
  }, [value]);

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full sm:w-64"
    />
  );
}
