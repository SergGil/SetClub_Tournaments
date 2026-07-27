import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-3">
          <Logo size={56} />
          <h1 className="text-4xl font-bold tracking-tight">{SITE_NAME}</h1>
        </div>
        <p className="max-w-xl text-lg text-muted-foreground">
          Місцевий тенісний клуб. Турніри 1×1, 2×2 та змішаного формату, загальний рейтинг
          учасників і повна історія результатів — усе в одному місці.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/tournaments" />}>Дивитись турніри</Button>
          <Button render={<Link href="/leaderboard" />} variant="outline">
            Загальний рейтинг
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Турніри</CardTitle>
            <CardDescription>Одиночні, парні та змішані формати з датами проведення.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Адміни створюють турніри та вносять результати матчів по ходу турніру.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Рейтинг клубу</CardTitle>
            <CardDescription>Загальна таблиця за всю історію.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Перемоги, поразки та відсоток перемог кожного учасника в усіх турнірах клубу.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Гравці</CardTitle>
            <CardDescription>Профіль та історія матчів кожного учасника.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Увійдіть через Google, щоб бачити деталі — редагування доступне лише адмінам.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
