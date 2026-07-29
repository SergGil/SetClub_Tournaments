import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Пагінація">
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} label="Попередня сторінка">
        <ChevronLeftIcon className="size-4" />
      </PageLink>
      <span className="px-2 text-sm text-muted-foreground tabular-nums">
        Сторінка {page} з {totalPages}
      </span>
      <PageLink href={buildHref(page + 1)} disabled={page >= totalPages} label="Наступна сторінка">
        <ChevronRightIcon className="size-4" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground/40"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
