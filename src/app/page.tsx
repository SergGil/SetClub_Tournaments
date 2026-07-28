import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNewsPosts } from "@/lib/queries/news";
import { SITE_NAME } from "@/lib/site";

export default async function HomePage() {
  const news = await getNewsPosts(3);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-3">
          <Logo size={56} />
          <h1 className="text-4xl font-bold tracking-tight">{SITE_NAME}</h1>
        </div>
        <p className="max-w-xl text-lg text-muted-foreground">
          Місцевий тенісний клуб у м. Південне, Одеська обл. Турніри 1×1, 2×2 та змішаного
          формату, загальний рейтинг учасників і повна історія результатів — усе в одному місці.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/tournaments" />}>Дивитись турніри</Button>
          <Button render={<Link href="/leaderboard" />} variant="outline">
            Загальний рейтинг
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/tournaments">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Турніри</CardTitle>
              <CardDescription>Одиночні, парні та змішані формати з датами проведення.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Адміни створюють турніри та вносять результати матчів по ходу турніру.
            </CardContent>
          </Card>
        </Link>
        <Link href="/leaderboard">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Рейтинг клубу</CardTitle>
              <CardDescription>Загальна таблиця за всю історію.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Перемоги, поразки та відсоток перемог кожного учасника в усіх турнірах клубу.
            </CardContent>
          </Card>
        </Link>
        <Link href="/players">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Гравці</CardTitle>
              <CardDescription>Профіль та історія матчів кожного учасника.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Увійдіть через Google, щоб бачити деталі — редагування доступне лише адмінам.
            </CardContent>
          </Card>
        </Link>
      </section>

      {news.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Новини клубу</h2>
          <div className="flex flex-col gap-3">
            {news.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <CardTitle className="text-base">{post.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString("uk-UA")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                  {post.body}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
