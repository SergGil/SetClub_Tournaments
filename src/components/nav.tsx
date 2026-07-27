import Link from "next/link";

import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { NAV_LINKS, SITE_NAME } from "@/lib/site";

export async function Nav() {
  const session = await auth();
  const user = session?.user;

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
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                  <AvatarFallback>{(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{user.name}</span>
                {user.role === "ADMIN" && <Badge variant="secondary">Адмін</Badge>}
              </div>
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
