import Link from "next/link";

import { LoadMore } from "@/components/load-more";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateKyiv } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { countLabel, NEWS_FORMS } from "@/lib/pluralize";
import { getNewsPostsPage } from "@/lib/queries/news";

export const metadata = { title: "Новини" };

const PAGE_SIZE = 20;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show: showParam } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const { posts, total } = await getNewsPostsPage(shown);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Новини клубу</h1>

      {posts.length === 0 && <p className="text-foreground/80">Новин ще немає.</p>}

      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <CardTitle className="text-base">
                  <Link href={`/news/${post.id}`} className="hover:underline">
                    {post.title}
                  </Link>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {formatDateKyiv(new Date(post.createdAt))} ·{" "}
                  {post.author.player?.name ?? post.author.name}
                </span>
              </div>
            </CardHeader>
            <CardContent className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
              {post.body}
            </CardContent>
          </Card>
        ))}
      </div>
      <LoadMore
        shown={posts.length}
        total={total}
        href={`/news?show=${shown + PAGE_SIZE}`}
        label={`Показано ${posts.length} з ${countLabel(total, NEWS_FORMS)}`}
      />
    </div>
  );
}
