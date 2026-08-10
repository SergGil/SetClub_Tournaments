import Link from "next/link";

import { Logo } from "@/components/logo";
import { NewsCard } from "@/components/news-card";
import { ResultsCarousel } from "@/components/results-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentCompletedMatches } from "@/lib/queries/matches";
import { getNewsPosts } from "@/lib/queries/news";
import { SITE_NAME } from "@/lib/site";

export default async function HomePage() {
  const [news, recentMatches] = await Promise.all([getNewsPosts(3), getRecentCompletedMatches(10)]);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4 py-8">
        <div className="flex items-center gap-3">
          <Logo size={56} />
          <h1 className="text-4xl font-bold tracking-tight">{SITE_NAME}</h1>
        </div>
        <p className="max-w-xl text-lg text-foreground/80">
          Місцевий тенісний клуб у м. Південне, Одеська обл. Турніри 1×1, 2×2 та змішаного
          формату, загальна статистика учасників і повна історія результатів — усе в одному місці.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/tournaments" />}>Дивитись турніри</Button>
          <Button render={<Link href="/rating" />} variant="outline">
            Рейтинг клубу
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/tournaments">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Турніри</CardTitle>
              <CardDescription>
                Одиночні, парні та змішані формати з датами проведення та результатами по ходу
                турніру.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/leaderboard">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Статистика клубу</CardTitle>
              <CardDescription>
                Перемоги, поразки та відсоток перемог кожного учасника за всю історію клубу.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/players">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="text-base">Гравці</CardTitle>
              <CardDescription>
                Профіль і повна історія матчів кожного учасника — увійдіть через Google, щоб
                пов&apos;язати акаунт із власним профілем.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      {recentMatches.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Останні результати</h2>
            <Link href="/matches" className="text-sm text-foreground/80 hover:text-foreground">
              Усі матчі →
            </Link>
          </div>
          <ResultsCarousel matches={recentMatches} />
        </section>
      )}

      {news.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Новини клубу</h2>
            <Link href="/news" className="text-sm text-foreground/80 hover:text-foreground">
              Усі новини →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {news.map((post) => (
              <NewsCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
