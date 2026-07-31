"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * A debounced `?q=` search box: typing updates the URL (and re-runs the
 * server query) after a short pause rather than on every keystroke, and uses
 * router.replace so partial queries don't pile up in browser history.
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
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = value.trim();
      router.replace(trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run the debounce on value changes, not on every router/pathname identity change
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
