import { HardHat, ListOrdered, Swords, TableProperties, Trophy } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDomainAdmin } from "@/lib/permissions";

export const metadata = { title: "Падел" };

// The real padel courts aren't open yet (site copy below), so PADEL_NAV_LINKS
// stays gated to superadmin/PADEL-domain admins (see nav.tsx) - a regular
// visitor who lands here directly still sees the same "under construction"
// placeholder as before. An authorized viewer instead gets a light hub
// linking to the four sections that now exist (mirrors /tennis's role as a
// landing page for its own nav links).
const SECTIONS = [
  { href: "/padel/tournaments", title: "Турніри", description: "Список турнірів і результати.", icon: Trophy },
  { href: "/padel/matches", title: "Матчі", description: "Стрічка всіх матчів клубу.", icon: Swords },
  { href: "/padel/leaderboard", title: "Статистика", description: "Загальна таблиця й активність клубу.", icon: TableProperties },
  { href: "/padel/rating", title: "Рейтинг", description: "Glicko-2/OpenSkill та бали SET.club.", icon: ListOrdered },
] as const;

export default async function PadelPage() {
  const authorized = await isDomainAdmin("PADEL");

  if (!authorized) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <HardHat className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Падел</h1>
        <p className="max-w-md text-foreground/80">
          Секція клубу для падел-тенісу вже готується — корти, тренери й розклад з&apos;являться тут
          після відкриття.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Падел</h1>
        <p className="text-sm text-foreground/80">
          Секція ще не відкрита публічно — цей розділ бачать лише суперадмін і Адмін Падела.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
