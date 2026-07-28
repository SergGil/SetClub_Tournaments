"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A whole-row navigation target. Table rows/cells are excluded from
 * `position: relative` by the CSS table layout spec in some browsers, so a
 * "stretched" absolutely-positioned <Link> inside one <td> is unreliable —
 * it can end up positioned against a distant ancestor and cover the entire
 * table, making every row navigate to whichever link painted last. Using a
 * real router navigation on click sidesteps that entirely.
 */
export function ClickableTableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow className={cn("cursor-pointer", className)} onClick={() => router.push(href)}>
      {children}
    </TableRow>
  );
}
