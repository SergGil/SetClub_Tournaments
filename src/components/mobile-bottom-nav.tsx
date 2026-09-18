"use client";

import {
  BarChart3,
  CheckCircle2,
  Coffee,
  Image as ImageIcon,
  MoreHorizontal,
  Newspaper,
  Trophy,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { isGenericPage } from "@/components/nav-home-hide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; exact?: boolean };
type TabItem = NavLink & { icon: ComponentType<{ className?: string }> };

// Curated 3-4 tab set per hub (docs/DESIGN_ROADMAP_2026.md #7) - the full
// per-hub link lists in lib/site.ts run 3-11 entries, too many for a
// thumb-width bottom bar. These are each hub's highest-traffic pages;
// everything else (plus ADMIN_NAV_LINK when Nav.tsx already folded it into
// the list passed down) is reachable through "Ще".
const TENNIS_TABS: TabItem[] = [
  { href: "/rating", label: "Рейтинг", icon: BarChart3 },
  { href: "/matches", label: "Матчі", icon: CheckCircle2 },
  { href: "/tournaments", label: "Турніри", icon: Trophy },
  { href: "/players", label: "Гравці", icon: User },
];

// /players has no Padel-scoped route of its own (unlike Теніс/Кава - see
// PADEL_NAV_LINKS' own comment in lib/site.ts), so this tab points at the
// same shared page the Tennis tabs use.
const PADEL_TABS: TabItem[] = [
  { href: "/padel/rating", label: "Рейтинг", icon: BarChart3 },
  { href: "/padel/matches", label: "Матчі", icon: CheckCircle2 },
  { href: "/padel/tournaments", label: "Турніри", icon: Trophy },
  { href: "/players", label: "Гравці", icon: User },
];

// Coffee only has one real page of its own (the menu) - the other two tabs
// point at the club-wide /news and /gallery feeds, same ?hub=coffee marker
// NavLinksInline/NavLinksDropdownItems use (see lib/site.ts).
const COFFEE_TABS: TabItem[] = [
  { href: "/coffee", label: "Меню", icon: Coffee, exact: true },
  { href: "/news?hub=coffee", label: "Новини", icon: Newspaper },
  { href: "/gallery?hub=coffee", label: "Фото", icon: ImageIcon },
];

/** A link's own path, ignoring any `?hub=...` marker - usePathname() never includes the query string. */
function hrefPathname(href: string): string {
  return href.split("?")[0];
}

function isTabActive(pathname: string, tab: TabItem): boolean {
  const path = hrefPathname(tab.href);
  return tab.exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
}

type MobileBottomNavProps = {
  defaultLinks: readonly NavLink[];
  coffeeLinks: readonly NavLink[];
  padelLinks: readonly NavLink[];
};

/**
 * Fixed thumb-reach bottom nav for phone-width browsers (docs/DESIGN_ROADMAP_2026.md
 * #7 - "нижня навігація як у мобільних застосунків", implemented as an
 * ordinary fixed bar rather than a native/PWA shell). Hidden on the same
 * "generic" pages HideOnHome hides the desktop Tennis nav on (`/` and
 * `/admin/*` - see isGenericPage's own comment in nav-home-hide.tsx): its
 * tabs are hub-specific, and `/admin` already owns its own mobile nav via
 * AdminNav + the header burger. Hidden at sm: and up too (this is a
 * phone-width affordance, not a tablet/desktop one - compare nav.tsx's own
 * min-[1400px] cutover for the *inline* desktop nav, an unrelated breakpoint).
 */
export function MobileBottomNav({
  defaultLinks,
  coffeeLinks,
  padelLinks,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  if (isGenericPage(pathname)) return null;

  const isCoffee = pathname.startsWith("/coffee");
  const isPadel = pathname.startsWith("/padel");
  const tabs = isCoffee ? COFFEE_TABS : isPadel ? PADEL_TABS : TENNIS_TABS;
  const fullLinks = isCoffee
    ? coffeeLinks
    : isPadel
      ? padelLinks
      : defaultLinks;

  const tabPaths = new Set(tabs.map((tab) => hrefPathname(tab.href)));
  const overflowLinks = fullLinks.filter(
    (link) => !tabPaths.has(hrefPathname(link.href)),
  );

  const anyTabActive = tabs.some((tab) => isTabActive(pathname, tab));
  // Lights up "Ще" when the current page is one of the overflow links (e.g.
  // /tennis/school, /leaderboard) rather than a plain tab.
  const moreActive =
    !anyTabActive &&
    overflowLinks.some((link) => {
      const path = hrefPathname(link.href);
      return pathname === path || pathname.startsWith(`${path}/`);
    });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label="Мобільна навігація"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
        {overflowLinks.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors",
                    moreActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
              }
            >
              <MoreHorizontal className="size-5" />
              Ще
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8}>
              {overflowLinks.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  render={<Link href={link.href} />}
                >
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
