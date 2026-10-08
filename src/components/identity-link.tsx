"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The signed-in member's avatar/name in the header: links to their own profile - the Padel
 * profile while browsing the Padel hub (a padel-only member has no tennis profile content),
 * the Tennis one everywhere else. Plain, non-link markup when no Player is linked to the
 * account yet.
 */
export function IdentityLink({
  player,
  children,
}: {
  player: { id: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!player) {
    return <div className="flex items-center gap-2">{children}</div>;
  }
  const inPadelHub = pathname === "/padel" || pathname.startsWith("/padel/");
  return (
    <Link href={inPadelHub ? `/padel/players/${player.id}` : `/players/${player.id}`} className="flex items-center gap-2">
      {children}
    </Link>
  );
}
