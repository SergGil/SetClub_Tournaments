"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { AdminDomain } from "@/generated/prisma/enums";

// "requiresDomain: undefined" means always visible (given the user has any
// admin access at all - AdminLayout already gates that); "TENNIS" means
// visible to superadmins or TENNIS-domain admins; "superadminOnly" is for
// sections that manage access itself (roles/domains) or span every domain
// (the full audit log) - see docs/ADMIN_DOMAINS.md.
const ADMIN_LINKS = [
  { href: "/admin", label: "Огляд" },
  { href: "/admin/players", label: "Гравці", requiresDomain: "TENNIS" },
  { href: "/admin/tournaments", label: "Турніри", requiresDomain: "TENNIS" },
  { href: "/admin/news", label: "Новини", requiresDomain: "TENNIS" },
  { href: "/admin/users", label: "Користувачі", superadminOnly: true },
  { href: "/admin/audit", label: "Журнал", superadminOnly: true },
] as const;

export function AdminNav({
  isSuperAdmin,
  domains,
}: {
  isSuperAdmin: boolean;
  domains: AdminDomain[];
}) {
  const pathname = usePathname();
  const visibleLinks = ADMIN_LINKS.filter((link) => {
    if (isSuperAdmin) return true;
    if ("superadminOnly" in link && link.superadminOnly) return false;
    if ("requiresDomain" in link) return domains.includes(link.requiresDomain);
    return true;
  });

  return (
    <nav className="mt-3 flex gap-4 overflow-x-auto rounded-t-lg border-b bg-card px-3 pt-2 text-sm">
      {visibleLinks.map((link) => {
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
