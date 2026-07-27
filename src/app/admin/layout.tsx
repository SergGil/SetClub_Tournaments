import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/permissions";

const ADMIN_LINKS = [
  { href: "/admin", label: "Огляд" },
  { href: "/admin/players", label: "Гравці" },
  { href: "/admin/tournaments", label: "Турніри" },
  { href: "/admin/users", label: "Користувачі" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.user?.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Адмін-панель</h1>
        <nav className="mt-3 flex gap-4 border-b text-sm">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pb-2 text-muted-foreground hover:text-foreground"
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
