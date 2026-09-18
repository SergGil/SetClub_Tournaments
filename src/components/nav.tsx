import { MenuIcon } from "lucide-react";
import Link from "next/link";

import { SignInButton } from "@/components/auth-buttons";
import { BackgroundToggle } from "@/components/background-toggle";
import { Logo } from "@/components/logo";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import {
  HideOnHome,
  HideOnHubPages,
  ShowOnAdminIfAuthorized,
  ShowOnHomeIfAuthorized,
  ShowOnPadelIfAuthorized,
} from "@/components/nav-home-hide";
import { NavLinksDropdownItems, NavLinksInline } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/auth";
import { getAdminScope } from "@/lib/permissions";
import { getPlayerByUserId } from "@/lib/queries/players";
import {
  ADMIN_NAV_LINK,
  COFFEE_NAV_LINKS,
  NAV_LINKS,
  PADEL_NAV_LINKS,
  SITE_NAME,
} from "@/lib/site";

export async function Nav() {
  // This call is why every single route in the app renders fully dynamic
  // (auth() reads cookies, a Request-time API) - see next.config.ts's
  // `cacheComponents` comment and docs/CACHE_COMPONENTS.md for why that's
  // investigated-and-reverted rather than fixed.
  const session = await auth();
  const user = session?.user;
  const player = user ? await getPlayerByUserId(user.id) : null;
  const displayName = player?.name ?? user?.name;
  const { isSuperAdmin, domains } = getAdminScope(session);
  const hasAdminAccess = isSuperAdmin || domains.length > 0;
  const hasTennisAdminAccess = isSuperAdmin || domains.includes("TENNIS");
  const hasCoffeeAdminAccess = isSuperAdmin || domains.includes("COFFEE");
  // Padel is still under construction (docs/HOMEPAGE.md) - nothing links to
  // it publicly yet, so only a superadmin or a PADEL-domain admin gets a nav
  // entry point at all; everyone else gets an empty link list while there.
  const hasPadelAdminAccess = isSuperAdmin || domains.includes("PADEL");
  const defaultLinks = hasAdminAccess
    ? [...NAV_LINKS, ADMIN_NAV_LINK]
    : NAV_LINKS;
  const coffeeLinks = hasCoffeeAdminAccess
    ? [...COFFEE_NAV_LINKS, ADMIN_NAV_LINK]
    : COFFEE_NAV_LINKS;
  const padelLinks = hasPadelAdminAccess
    ? [...PADEL_NAV_LINKS, ADMIN_NAV_LINK]
    : [];

  return (
    <>
      <header className="border-b bg-background">
        {/*
        Wider than <main>'s max-w-5xl on purpose - a header-only max-width
        gives the nav row real breathing room without touching page-content
        alignment below it. IMPORTANT: this cap bounds the header's content
        width outright - once the left+right clusters don't fit within it,
        NO viewport width fixes it (a wider window doesn't grow the header
        past this max-w), so the number here has to be measured against the
        two clusters' actual content width, not against "does it look fine
        on my screen".
        History: max-w-6xl (1152px) -> max-w-7xl (1280px) once 10 nav links
        (incl. "Падел" potential) + the logged-in right cluster (theme + up
        to 2 background toggles + burger + avatar/name/"Суперадмін" badge +
        "Вийти") stopped fitting in 1152px. Then the Tennis link list grew
        to 11 (with "Школа") and, separately, a superadmin's 12th link
        (ADMIN_NAV_LINK, "Адмін-панель") pushed measured content width (left
        cluster scrollWidth + right cluster scrollWidth, 12 links + badge +
        "Гільченко Сергій"-length name) to ~1319px - past even max-w-7xl's
        1280px, so "Вийти" wrapped again for every superadmin at every
        window width. max-w-[92rem] (1472px) leaves ~150px of margin over
        that measured 1319px instead of the ~0px slack a tighter value would
        give back immediately as soon as one more link (or a longer admin
        name) shows up.
        The inline-nav/burger/badge cutover (nav-links.tsx's NavLinksInline,
        this file's burger trigger and the "Суперадмін" Badge below) is
        pinned to the same `min-[1400px]` breakpoint rather than a named one
        (lg/xl) for the same reason: since this header's width tracks the
        viewport below max-w-[92rem], the turn-on point has to sit at or
        above the narrowest viewport where the row actually fits, or there's
        a dead zone that still wraps - see the long comment on
        NavLinksInline for the concrete case (xl: at 1280px) that broke.
        `flex-wrap` here (added for mobile /admin, where the burger menu and
        section nav are both hidden - see HideOnHome/isGenericPage - so the
        left cluster is just logo + "Адмін-панель" and the right cluster is
        theme + avatar + "Вийти", no width gating on either): below ~430px
        those two clusters no longer both fit on one row even with nothing
        extra in them. Without `flex-wrap` here, the *right* cluster's own
        `flex-wrap` (below) was the only thing that could give, splitting
        "Вийти" alone onto its own row while theme+avatar stayed squeezed in
        next to the left cluster - the exact bug reported after the
        max-w-[92rem] fix above, which only covered the desktop-width case.
        Wrapping at this outer level instead drops the *whole* right cluster
        to a clean second row together, which reliably has room (measured
        ~165px vs. as little as ~320px available at a 320px viewport).
      */}
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
            >
              <Logo size={32} />
              {SITE_NAME}
            </Link>
            <HideOnHome>
              <NavLinksInline
                defaultLinks={defaultLinks}
                coffeeLinks={coffeeLinks}
                padelLinks={padelLinks}
              />
            </HideOnHome>
            <ShowOnHomeIfAuthorized authorized={hasAdminAccess}>
              <Link
                href="/admin"
                className="text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
              >
                Адмін-панель
              </Link>
            </ShowOnHomeIfAuthorized>
            {/*
            hidden below sm: (640px) - these 3 links plus "Адмін-панель"
            above are the left cluster's whole content on /admin (HideOnHome
            hides the section nav there), none of it width-gated like
            NavLinksInline is. On a real phone width (~390px) all 4 links +
            the right cluster's avatar/"Вийти" overflowed past the edge
            (found via a mobile-layout pass, not by a wrap - unlike the
            "Вийти" flex-wrap bug documented on the header div above, this
            is plain horizontal overflow with nowrap text and no fallback,
            since /admin also hides the burger menu). Keeping just
            "Адмін-панель" on mobile (its own long-standing behavior,
            unchanged here) and folding these 3 in from sm: up keeps this
            purely a "convenience for wider screens" feature rather than
            fixing mobile /admin nav more broadly.
          */}
            <ShowOnAdminIfAuthorized authorized={hasTennisAdminAccess}>
              <Link
                href="/tennis"
                className="hidden text-sm whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline"
              >
                Теніс
              </Link>
            </ShowOnAdminIfAuthorized>
            <ShowOnAdminIfAuthorized authorized={hasCoffeeAdminAccess}>
              <Link
                href="/coffee"
                className="hidden text-sm whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline"
              >
                Кава
              </Link>
            </ShowOnAdminIfAuthorized>
            <ShowOnAdminIfAuthorized authorized={hasPadelAdminAccess}>
              <Link
                href="/padel"
                className="hidden text-sm whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline"
              >
                Падел
              </Link>
            </ShowOnAdminIfAuthorized>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeToggle />
            <HideOnHubPages>
              <BackgroundToggle
                storageKey="setclub:bg-photo"
                htmlClass="bg-photo"
                label="Фото корту як фон сайту"
              />
            </HideOnHubPages>
            <ShowOnPadelIfAuthorized authorized={hasPadelAdminAccess}>
              <BackgroundToggle
                storageKey="setclub:bg-photo-padel"
                htmlClass="bg-photo-padel"
                label="Фото падел-корту як фон сайту"
              />
            </ShowOnPadelIfAuthorized>
            <HideOnHome>
              {/*
                Visible only for the 640-1400px tablet band. Below 640px,
                MobileBottomNav's own "Ще" button already opens this exact
                same dropdown content (NavLinksDropdownItems, same
                defaultLinks/coffeeLinks/padelLinks props) from the bottom
                bar, so this header trigger was a second identical menu
                stacked on top of the first. Still needed for 640-1400px,
                where MobileBottomNav itself is `sm:hidden` and
                NavLinksInline (min-[1400px]:flex) hasn't turned on yet -
                that band has no other way to reach these links.
                `min-[640px]:max-[1400px]:inline-flex` as ONE compound
                variant, not separate `sm:inline-flex` + `min-[1400px]:hidden`
                utilities - mixing a named breakpoint (`sm:`) with an
                arbitrary one (`min-[1400px]:`) for the same property isn't
                reliably ordered in the generated CSS (verified live: the
                burger stayed visible past 1400px with that combination,
                double-menu-ing alongside NavLinksInline). A single compound
                arbitrary-range variant has no such ordering to get wrong.
                `max-[1400px]` (not `max-[1399px]`) matches Tailwind's own
                -0.02px convention for `max-*` variants, so this band's own
                upper edge lines up exactly with NavLinksInline's inclusive
                `min-[1400px]` lower edge - checked live at the exact 1399px/
                1400px integer boundary, not just "close enough".
              */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hidden size-11 min-[640px]:max-[1400px]:inline-flex"
                    />
                  }
                >
                  <MenuIcon />
                  <span className="sr-only">Меню</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <NavLinksDropdownItems
                    defaultLinks={defaultLinks}
                    coffeeLinks={coffeeLinks}
                    padelLinks={padelLinks}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </HideOnHome>

            {user ? (
              <>
                <IdentityLink player={player}>
                  <Avatar className="size-7">
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={displayName ?? ""}
                    />
                    <AvatarFallback>
                      {(displayName ?? user.email ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-36 truncate text-sm md:inline">
                    {displayName}
                  </span>
                  {hasAdminAccess && (
                    <Badge
                      variant="accent"
                      className="hidden min-[1400px]:inline-flex"
                    >
                      {isSuperAdmin ? "Суперадмін" : "Адмін"}
                    </Badge>
                  )}
                </IdentityLink>
                <SignOutButton />
              </>
            ) : (
              <SignInButton />
            )}
          </div>
        </div>
      </header>
      <MobileBottomNav
        defaultLinks={defaultLinks}
        hasTennisAdminAccess={hasTennisAdminAccess}
        hasCoffeeAdminAccess={hasCoffeeAdminAccess}
        hasPadelAdminAccess={hasPadelAdminAccess}
        coffeeLinks={coffeeLinks}
        padelLinks={padelLinks}
      />
    </>
  );
}

function IdentityLink({
  player,
  children,
}: {
  player: { id: string } | null;
  children: React.ReactNode;
}) {
  if (!player) {
    return <div className="flex items-center gap-2">{children}</div>;
  }
  return (
    <Link href={`/players/${player.id}`} className="flex items-center gap-2">
      {children}
    </Link>
  );
}
