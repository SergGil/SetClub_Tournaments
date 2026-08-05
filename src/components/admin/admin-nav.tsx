"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ADMIN_LINKS = [
  { href: "/admin", label: "Огляд" },
  { href: "/admin/players", label: "Гравці" },
  { href: "/admin/tournaments", label: "Турніри" },
  { href: "/admin/news", label: "Новини" },
  { href: "/admin/users", label: "Користувачі" },
  { href: "/admin/audit", label: "Журнал" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex gap-4 overflow-x-auto rounded-t-lg border-b bg-card px-3 pt-2 text-sm">
      {ADMIN_LINKS.map((link) => {
        // "/admin" itself must match exactly - startsWith would also match
        // every other admin route, since they all begin with "/admin".
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 pb-2 whitespace-nowrap transition-colors",
              isActive
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-foreground/80 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
