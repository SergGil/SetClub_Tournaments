import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminScope, getSession } from "@/lib/permissions";

const SECTIONS = [
  {
    href: "/admin/players",
    title: "Гравці",
    description: "Додавання гравців, зв'язок з Google-акаунтом.",
    requiresDomain: "TENNIS",
  },
  {
    href: "/admin/tournaments",
    title: "Турніри",
    description: "Створення турнірів, ростер, матчі та результати.",
    requiresDomain: "TENNIS",
  },
  {
    href: "/admin/news",
    title: "Новини",
    description: "Публікація новин клубу на головній сторінці.",
    requiresDomain: "TENNIS",
  },
  {
    href: "/admin/users",
    title: "Користувачі",
    description: "Керування ролями та адмін-розділами користувачів.",
    superadminOnly: true,
  },
  {
    href: "/admin/audit",
    title: "Журнал",
    description: "Хто, що і коли змінив — журнал усіх адмін-дій.",
    superadminOnly: true,
  },
] as const;

export default async function AdminHomePage() {
  const { isSuperAdmin, domains } = getAdminScope(await getSession());
  const sections = SECTIONS.filter((section) => {
    if (isSuperAdmin) return true;
    if ("superadminOnly" in section && section.superadminOnly) return false;
    if ("requiresDomain" in section) return domains.includes(section.requiresDomain);
    return true;
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {sections.map((section) => (
        <Link key={section.href} href={section.href}>
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
