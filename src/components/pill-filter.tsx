import Link from "next/link";

import { cn } from "@/lib/utils";

/** Segmented-control-style wrapper for a row of `PillFilterLink`s. */
export function PillFilterGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm", className)}>
      {children}
    </div>
  );
}

export function PillFilterLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
