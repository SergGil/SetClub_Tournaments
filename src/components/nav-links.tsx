"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; exact?: boolean };

// "exact: true" is for a hub link whose href is also a string-prefix of
// other links in the same list (e.g. "/tennis" vs "/tennis/coaches", or
// "/padel" vs "/padel/tournaments") - without it, startsWith would mark it
// active alongside whichever specific subpage is actually current, same
// reasoning as admin-nav.tsx's "/admin" special case.
function useIsActive(href: string, exact?: boolean) {
  const pathname = usePathname();
  return exact ? pathname === href : pathname.startsWith(href);
}

/** /coffee and /padel are their own hubs (see COFFEE_NAV_LINKS/PADEL_NAV_LINKS in lib/site.ts) - everywhere else gets the Tennis-oriented default set. */
function useSectionLinks(
  defaultLinks: readonly NavLink[],
  coffeeLinks: readonly NavLink[],
  padelLinks: readonly NavLink[],
) {
  const pathname = usePathname();
  if (pathname.startsWith("/coffee")) return coffeeLinks;
  if (pathname.startsWith("/padel")) return padelLinks;
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

/** Inline nav row shown at lg: and up - active link highlighted, same aria-current pattern as admin-nav.tsx. */
export function NavLinksInline({
  defaultLinks,
  coffeeLinks,
  padelLinks,
}: {
  defaultLinks: readonly NavLink[];
  coffeeLinks: readonly NavLink[];
  padelLinks: readonly NavLink[];
}) {
  const links = useSectionLinks(defaultLinks, coffeeLinks, padelLinks);
  return (
    <nav className="hidden items-center gap-4 text-sm lg:flex">
      {links.map((link) => (
        <NavLinkItem key={link.href} link={link} />
      ))}
    </nav>
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

/** Same links, same active-state logic, as items inside the mobile hamburger dropdown. */
export function NavLinksDropdownItems({
  defaultLinks,
  coffeeLinks,
  padelLinks,
}: {
  defaultLinks: readonly NavLink[];
  coffeeLinks: readonly NavLink[];
  padelLinks: readonly NavLink[];
}) {
  const links = useSectionLinks(defaultLinks, coffeeLinks, padelLinks);
  return (
    <>
      {links.map((link) => (
        <NavDropdownLinkItem key={link.href} link={link} />
      ))}
    </>
  );
}
