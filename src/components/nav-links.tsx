"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; exact?: boolean };

type SectionLinksProps = {
  defaultLinks: readonly NavLink[];
  coffeeLinks: readonly NavLink[];
  padelLinks: readonly NavLink[];
};

/** A link's own path, ignoring any `?hub=...` marker (see useSectionLinks) - usePathname() never includes the query string, so comparing against the full href would never match. */
function hrefPathname(href: string): string {
  return href.split("?")[0];
}

// "exact: true" is for a hub link whose href is also a string-prefix of
// other links in the same list (e.g. "/tennis" vs "/tennis/coaches", or
// "/padel" vs "/padel/tournaments") - without it, startsWith would mark it
// active alongside whichever specific subpage is actually current, same
// reasoning as admin-nav.tsx's "/admin" special case.
function useIsActive(href: string, exact?: boolean) {
  const pathname = usePathname();
  const path = hrefPathname(href);
  return exact ? pathname === path : pathname.startsWith(path);
}

/**
 * /coffee and /padel are their own hubs (see COFFEE_NAV_LINKS/PADEL_NAV_LINKS
 * in lib/site.ts) - everywhere else gets the Tennis-oriented default set,
 * EXCEPT /news and /gallery: those are club-wide pages that don't sit under
 * a /coffee or /padel path themselves, so a plain prefix check would always
 * fall through to the Tennis default even when you followed the link from
 * Coffee's or Padel's own nav - losing that hub's links (and its own way
 * back) the moment you leave /coffee or /padel. Those two links carry a
 * `?hub=coffee`/`?hub=padel` marker for exactly this - read back here so the
 * nav list you were just looking at keeps showing.
 */
function useSectionLinks(
  defaultLinks: readonly NavLink[],
  coffeeLinks: readonly NavLink[],
  padelLinks: readonly NavLink[],
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname.startsWith("/coffee")) return coffeeLinks;
  if (pathname.startsWith("/padel")) return padelLinks;
  const hub = searchParams.get("hub");
  if (hub === "coffee") return coffeeLinks;
  if (hub === "padel") return padelLinks;
  return defaultLinks;
}

function NavLinkItem({ link }: { link: NavLink }) {
  const isActive = useIsActive(link.href, link.exact);
  return (
    <Link
      href={link.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "whitespace-nowrap transition-colors hover:text-foreground",
        isActive ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {link.label}
    </Link>
  );
}

function NavLinksInlineContent({ defaultLinks, coffeeLinks, padelLinks }: SectionLinksProps) {
  const links = useSectionLinks(defaultLinks, coffeeLinks, padelLinks);
  return (
    <nav className="hidden items-center gap-4 text-sm min-[1400px]:flex">
      {links.map((link) => (
        <NavLinkItem key={link.href} link={link} />
      ))}
    </nav>
  );
}

/**
 * Inline nav row shown at 1400px and up - active link highlighted, same
 * aria-current pattern as admin-nav.tsx. Was lg: (1024px), then xl:
 * (1280px), before landing on this custom breakpoint - see nav.tsx's header
 * comment for the full width budget this has to satisfy (currently ~1319px
 * for a superadmin's 12-link row + badge + name + "Вийти"). A *named*
 * Tailwind breakpoint (lg/xl) is the wrong tool here: nav.tsx's header caps
 * its own content width at max-w-[92rem] (1472px), so below that the
 * header's actual width tracks the viewport 1:1 - meaning the breakpoint
 * where the inline nav turns on has to be at least as large as the
 * narrowest viewport where the row is measured to fit, or there's a dead
 * zone (viewport wide enough to satisfy xl: but not wide enough to fit the
 * content) where "Вийти" wraps anyway. That's exactly what happened at
 * xl: (1280px) once the superadmin-only "Адмін-панель" link pushed the
 * needed width past 1280px: everything from 1280-~1335px wrapped. Using
 * `min-[1400px]:` instead of a named breakpoint keeps the turn-on point
 * pinned to the actual measured requirement (with ~80px margin) instead of
 * to whichever named breakpoint happens to be closest - if the link list
 * (or an admin badge/name) grows again, re-measure and move this literal
 * value, don't reach for the next named breakpoint up. Wrapped in
 * Suspense: useSectionLinks reads useSearchParams, which Next requires a
 * Suspense boundary around (a static page calling it outside one fails the
 * production build - see node_modules/next/dist/docs/.../use-search-params.md).
 * Every route in this app renders fully dynamic today regardless (Nav's own
 * auth() call - see next.config.ts's cacheComponents comment), so this never
 * actually suspends visibly; it's here so that stays true even if that changes.
 */
export function NavLinksInline(props: SectionLinksProps) {
  return (
    <Suspense fallback={<nav className="hidden items-center gap-4 text-sm min-[1400px]:flex" />}>
      <NavLinksInlineContent {...props} />
    </Suspense>
  );
}

function NavDropdownLinkItem({ link }: { link: NavLink }) {
  const isActive = useIsActive(link.href, link.exact);
  return (
    <DropdownMenuItem aria-current={isActive ? "page" : undefined} render={<Link href={link.href} />}>
      {link.label}
    </DropdownMenuItem>
  );
}

function NavLinksDropdownItemsContent({ defaultLinks, coffeeLinks, padelLinks }: SectionLinksProps) {
  const links = useSectionLinks(defaultLinks, coffeeLinks, padelLinks);
  return (
    <>
      {links.map((link) => (
        <NavDropdownLinkItem key={link.href} link={link} />
      ))}
    </>
  );
}

/** Same links, same active-state logic, as items inside the mobile hamburger dropdown - see NavLinksInline for why this is Suspense-wrapped too. */
export function NavLinksDropdownItems(props: SectionLinksProps) {
  return (
    <Suspense fallback={null}>
      <NavLinksDropdownItemsContent {...props} />
    </Suspense>
  );
}
