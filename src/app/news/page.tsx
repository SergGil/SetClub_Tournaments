import { LoadMore } from "@/components/load-more";
import { NewsCard } from "@/components/news-card";
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
          <NewsCard key={post.id} post={post} authorLabel={post.author.player?.name ?? post.author.name} />
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
