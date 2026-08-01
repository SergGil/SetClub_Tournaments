import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/permissions";

const ADMIN_LINKS = [
  { href: "/admin", label: "Огляд" },
  { href: "/admin/players", label: "Гравці" },
  { href: "/admin/tournaments", label: "Турніри" },
  { href: "/admin/news", label: "Новини" },
  { href: "/admin/users", label: "Користувачі" },
  { href: "/admin/audit", label: "Журнал" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  // Signed in but not an admin: sending them back to /login would just bounce
  // straight back here (the login page redirects anyone already signed in to
  // callbackUrl), producing an infinite redirect loop. Send them home instead.
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Адмін-панель</h1>
        <nav className="mt-3 flex gap-4 rounded-t-lg border-b bg-card px-3 pt-2 text-sm">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pb-2 text-foreground/80 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
