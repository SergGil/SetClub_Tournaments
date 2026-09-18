"use client";

import {
  BarChart3,
  CheckCircle2,
  Coffee,
  Image as ImageIcon,
  MoreHorizontal,
  Newspaper,
  Trophy,
  Volleyball,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { ComponentType, ReactNode } from "react";

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
  { href: "/news", label: "Новини", icon: Newspaper },
  { href: "/tournaments", label: "Турніри", icon: Trophy },
  { href: "/matches", label: "Матчі", icon: CheckCircle2 },
  { href: "/rating", label: "Рейтинг", icon: BarChart3 },
];

// /news carries Padel's own `?hub=padel` marker (see PADEL_NAV_LINKS in
// lib/site.ts) so following it keeps this hub's nav showing on the way back.
const PADEL_TABS: TabItem[] = [
  { href: "/news?hub=padel", label: "Новини", icon: Newspaper },
  { href: "/padel/tournaments", label: "Турніри", icon: Trophy },
  { href: "/padel/matches", label: "Матчі", icon: CheckCircle2 },
  { href: "/padel/rating", label: "Рейтинг", icon: BarChart3 },
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

const TAB_ITEM_CLASS =
  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors";

function BottomNavBar({ children }: { children: ReactNode }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label="Мобільна навігація"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around">
        {children}
      </div>
    </nav>
  );
}

// Shared by the `/` and `/admin` branches below - both are a flat list of
// hub-quick-link tabs with no "current page" to highlight (neither ever sits
// ON /coffee, /tennis or /padel itself), unlike the per-hub tab sets further
// down, which do track an active tab.
function PlainTabsBar({ tabs }: { tabs: TabItem[] }) {
  return (
    <BottomNavBar>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(TAB_ITEM_CLASS, "text-muted-foreground")}
          >
            <Icon className="size-5" />
            {tab.label}
          </Link>
        );
      })}
    </BottomNavBar>
  );
}

type MobileBottomNavProps = {
  defaultLinks: readonly NavLink[];
  coffeeLinks: readonly NavLink[];
  padelLinks: readonly NavLink[];
  hasTennisAdminAccess: boolean;
  hasCoffeeAdminAccess: boolean;
  hasPadelAdminAccess: boolean;
};

// On /admin, ShowOnAdminIfAuthorized already gives each authorized domain a
// text link back to its public hub page (Теніс/Кава/Падел) in the desktop
// header row - but that row is `sm:inline`-gated (nav.tsx's own comment on
// it explains why: it overflowed a real phone width once shown alongside
// the avatar/"Вийти" cluster), so a phone-width admin had no quick way back
// out to the public site at all. This is that same jump, as bottom-nav tabs
// instead of header text.
function buildAdminHubTabs(access: {
  tennis: boolean;
  coffee: boolean;
  padel: boolean;
}): TabItem[] {
  const tabs: TabItem[] = [];
  if (access.tennis)
    tabs.push({ href: "/tennis", label: "Теніс", icon: Trophy, exact: true });
  if (access.coffee)
    tabs.push({ href: "/coffee", label: "Кава", icon: Coffee, exact: true });
  if (access.padel)
    tabs.push({
      href: "/padel",
      label: "Падел",
      icon: Volleyball,
      exact: true,
    });
  return tabs;
}

// `/` is the triple-split hub picker (docs/HOMEPAGE.md, triple-split.tsx) -
// Кава and Теніс are always real public destinations, but Падел is "still
// under construction" there too: triple-split.tsx only makes its own Падел
// panel clickable when `padelAuthorized`, so this mirrors that same gate
// (Nav.tsx's hasPadelAdminAccess) rather than linking somewhere a plain
// visitor can't actually use yet.
function buildHomeHubTabs(padelAuthorized: boolean): TabItem[] {
  const tabs: TabItem[] = [
    { href: "/coffee", label: "Кава", icon: Coffee, exact: true },
    { href: "/tennis", label: "Теніс", icon: Trophy, exact: true },
  ];
  if (padelAuthorized)
    tabs.push({
      href: "/padel",
      label: "Падел",
      icon: Volleyball,
      exact: true,
    });
  return tabs;
}

function MobileBottomNavContent({
  defaultLinks,
  coffeeLinks,
  padelLinks,
  hasTennisAdminAccess,
  hasCoffeeAdminAccess,
  hasPadelAdminAccess,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === "/") {
    return <PlainTabsBar tabs={buildHomeHubTabs(hasPadelAdminAccess)} />;
  }

  if (pathname.startsWith("/admin")) {
    const adminTabs = buildAdminHubTabs({
      tennis: hasTennisAdminAccess,
      coffee: hasCoffeeAdminAccess,
      padel: hasPadelAdminAccess,
    });
    if (adminTabs.length === 0) return null;
    return <PlainTabsBar tabs={adminTabs} />;
  }

  // /news and /gallery are club-wide pages that don't sit under a /coffee or
  // /padel path themselves - same `?hub=` marker fallback as nav-links.tsx's
  // own useSectionLinks, needed for exactly the same reason: without it,
  // tapping this bar's own "Новини"/"Фото" tab from the Coffee/Padel tab
  // sets below landed back on the Tennis tab set the moment the URL's path
  // stopped starting with /coffee or /padel.
  const hub = searchParams.get("hub");
  const isCoffee = pathname.startsWith("/coffee") || hub === "coffee";
  const isPadel = pathname.startsWith("/padel") || hub === "padel";
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
    <BottomNavBar>
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              TAB_ITEM_CLASS,
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
                  TAB_ITEM_CLASS,
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
    </BottomNavBar>
  );
}

/**
 * Fixed thumb-reach bottom nav for phone-width browsers (docs/DESIGN_ROADMAP_2026.md
 * #7 - "нижня навігація як у мобільних застосунків", implemented as an
 * ordinary fixed bar rather than a native/PWA shell). Hidden at sm: and up
 * (this is a phone-width affordance, not a tablet/desktop one - compare
 * nav.tsx's own min-[1400px] cutover for the *inline* desktop nav, an
 * unrelated breakpoint). Its tabs switch by section: `/` gets
 * buildHomeHubTabs' Кава/Теніс/Падел quick-picks (mirroring the
 * triple-split panels themselves); `/admin/*` gets buildAdminHubTabs'
 * quick-links back to whichever hub(s) this admin actually administers -
 * AdminNav already owns in-section navigation there
 * (Огляд/Гравці/Турніри/...), this bar's job on admin pages is purely "how
 * do I get back to the public site"; everywhere else gets the per-hub tab
 * sets above (TENNIS_TABS/PADEL_TABS/COFFEE_TABS) plus "Ще". Suspense-wrapped
 * because MobileBottomNavContent reads useSearchParams - same requirement
 * and fallback pattern as NavLinksInline/NavLinksDropdownItems (nav-links.tsx).
 */
export function MobileBottomNav(props: MobileBottomNavProps) {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavContent {...props} />
    </Suspense>
  );
}
