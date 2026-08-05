import { MenuIcon } from "lucide-react";
import Link from "next/link";

import { SignInButton } from "@/components/auth-buttons";
import { BackgroundToggle } from "@/components/background-toggle";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/auth";
import { getPlayerByUserId } from "@/lib/queries/players";
import { NAV_LINKS, SITE_NAME } from "@/lib/site";

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const player = user ? await getPlayerByUserId(user.id) : null;
  const displayName = player?.name ?? user?.name;
  const links = user?.role === "ADMIN" ? [...NAV_LINKS, { href: "/admin", label: "Адмін-панель" }] : NAV_LINKS;

  return (
    <header className="border-b bg-background">
      {/*
        Wider than <main>'s max-w-5xl on purpose: at the breakpoint where the
        full nav row appears, the content column's width alone left ~0px of
        slack once the real (long) admin name + "Адмін" badge + sign-out
        button were all showing at once - a header-only max-width gives that
        row real breathing room without touching page-content alignment
        below it. The nav links now show starting at lg: (1024px, was xl:)
        for a roomier tablet experience, but the "Адмін" badge below is
        deliberately kept at xl: - it's the one element that caused the
        original overflow, so it stays hidden through the 1024-1279px range
        that no longer has the extra width budget.
      */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight">
            <Logo size={32} />
            {SITE_NAME}
          </Link>
          <nav className="hidden items-center gap-4 text-sm lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <BackgroundToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className="size-11 lg:hidden" />}
            >
              <MenuIcon />
              <span className="sr-only">Меню</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {links.map((link) => (
                <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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
                {user.role === "ADMIN" && <Badge variant="accent" className="hidden xl:inline-flex">Адмін</Badge>}
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
