import { MenuIcon } from "lucide-react";
import Link from "next/link";

import { SignInButton } from "@/components/auth-buttons";
import { BackgroundToggle } from "@/components/background-toggle";
import { Logo } from "@/components/logo";
import {
  HideOnHome,
  HideOnHubPages,
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
import { ADMIN_NAV_LINK, COFFEE_NAV_LINKS, NAV_LINKS, PADEL_NAV_LINKS, SITE_NAME } from "@/lib/site";

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
  const hasCoffeeAdminAccess = isSuperAdmin || domains.includes("COFFEE");
  // Padel is still under construction (docs/HOMEPAGE.md) - nothing links to
  // it publicly yet, so only a superadmin or a PADEL-domain admin gets a nav
  // entry point at all; everyone else gets an empty link list while there.
  const hasPadelAdminAccess = isSuperAdmin || domains.includes("PADEL");
  const defaultLinks = hasAdminAccess ? [...NAV_LINKS, ADMIN_NAV_LINK] : NAV_LINKS;
  const coffeeLinks = hasCoffeeAdminAccess ? [...COFFEE_NAV_LINKS, ADMIN_NAV_LINK] : COFFEE_NAV_LINKS;
  const padelLinks = hasPadelAdminAccess ? [...PADEL_NAV_LINKS, ADMIN_NAV_LINK] : [];

  return (
    <header className="border-b bg-background">
      {/*
        Wider than <main>'s max-w-5xl on purpose - a header-only max-width
        gives the nav row real breathing room without touching page-content
        alignment below it. max-w-6xl (1152px) measured out to ~725px for the
        left cluster (logo + up to 10 nowrap nav links, now incl. "Падел"
        potential) and ~420-450px needed by the right cluster (theme + up to
        2 background toggles + burger + avatar/name/"Суперадмін" badge +
        "Вийти") - a ~30-50px deficit that silently wrapped "Вийти" onto its
        own line even for a short admin name at 1920px wide, sitting right
        under the badge. max-w-7xl (1280px) leaves a real buffer instead of
        the ~0px slack the previous size had. The nav links show starting at
        lg: (1024px) for a roomier tablet experience; the "Адмін"/"Суперадмін"
        badge stays xl:-only since it's the single biggest contributor to the
        right cluster's width.
      */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight">
            <Logo size={32} />
            {SITE_NAME}
          </Link>
          <HideOnHome>
            <NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
          </HideOnHome>
          <ShowOnHomeIfAuthorized authorized={hasAdminAccess}>
            <Link href="/admin" className="text-sm whitespace-nowrap text-muted-foreground hover:text-foreground">
              Адмін-панель
            </Link>
          </ShowOnHomeIfAuthorized>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
          <HideOnHubPages>
            <BackgroundToggle storageKey="setclub:bg-photo" htmlClass="bg-photo" label="Фото корту як фон сайту" />
          </HideOnHubPages>
          <ShowOnPadelIfAuthorized authorized={hasPadelAdminAccess}>
            <BackgroundToggle
              storageKey="setclub:bg-photo-padel"
              htmlClass="bg-photo-padel"
              label="Фото падел-корту як фон сайту"
            />
          </ShowOnPadelIfAuthorized>
          <HideOnHome>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" className="size-11 lg:hidden" />}
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
                  <AvatarImage src={user.image ?? undefined} alt={displayName ?? ""} />
                  <AvatarFallback>
                    {(displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate text-sm md:inline">{displayName}</span>
                {hasAdminAccess && (
                  <Badge variant="accent" className="hidden xl:inline-flex">
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
