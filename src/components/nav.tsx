import Link from "next/link";

import { SignInButton } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { getPlayerByUserId } from "@/lib/queries/players";
import { NAV_LINKS, SITE_NAME } from "@/lib/site";

export async function Nav() {
  const session = await auth();
  const user = session?.user;
  const player = user ? await getPlayerByUserId(user.id) : null;
  const displayName = player?.name ?? user?.name;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Logo size={32} />
            {SITE_NAME}
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Адмін-панель
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <IdentityLink player={player}>
                <Avatar className="size-7">
                  <AvatarImage src={user.image ?? undefined} alt={displayName ?? ""} />
                  <AvatarFallback>
                    {(displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{displayName}</span>
                {user.role === "ADMIN" && <Badge variant="secondary">Адмін</Badge>}
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
