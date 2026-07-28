import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/admin/players",
    title: "Гравці",
    description: "Додавання гравців, зв'язок з Google-акаунтом.",
  },
  {
    href: "/admin/tournaments",
    title: "Турніри",
    description: "Створення турнірів, ростер, матчі та результати.",
  },
  {
    href: "/admin/news",
    title: "Новини",
    description: "Публікація новин клубу на головній сторінці.",
  },
  {
    href: "/admin/users",
    title: "Користувачі",
    description: "Керування ролями зареєстрованих користувачів.",
  },
] as const;

export default function AdminHomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SECTIONS.map((section) => (
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
