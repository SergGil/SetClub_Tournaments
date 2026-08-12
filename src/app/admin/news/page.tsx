import { PencilIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { DeleteNewsButton } from "@/components/admin/delete-news-button";
import { NewsDialog } from "@/components/admin/news-dialog";
import { LoadMore } from "@/components/load-more";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { formatDateKyiv } from "@/lib/date-format";
import { parseShowParam } from "@/lib/load-more";
import { isDomainAdmin } from "@/lib/permissions";
import { countLabel, NEWS_FORMS } from "@/lib/pluralize";
import { getNewsPostsPage } from "@/lib/queries/news";
import { publicPhotoUrl } from "@/lib/r2";

const PAGE_SIZE = 20;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  if (!(await isDomainAdmin("TENNIS"))) {
    redirect("/admin");
  }

  const { show: showParam, q: query } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const { posts, total } = await getNewsPostsPage(shown, query);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">
          {total > 0 || query ? countLabel(total, NEWS_FORMS) : "Ще немає жодної новини."}
        </p>
        <NewsDialog
          trigger={
            <Button>
              <PlusIcon /> Додати новину
            </Button>
          }
        />
      </div>

      <SearchInput placeholder="Пошук за заголовком" defaultValue={query} />

      <div className="flex flex-col gap-2">
        {posts.length === 0 && query && (
          <p className="py-8 text-center text-sm text-muted-foreground">Нічого не знайдено.</p>
        )}
        {posts.map((post) => {
          const photoUrl = post.photoKey ? publicPhotoUrl(post.photoKey) : null;
          return (
            <div key={post.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  {photoUrl && (
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md">
                      <Image src={photoUrl} alt="" fill sizes="80px" className="object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateKyiv(new Date(post.createdAt))} ·{" "}
                      {post.author.player?.name ?? post.author.name}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <NewsDialog
                    post={{ ...post, photoUrl }}
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <PencilIcon />
                        <span className="sr-only">Редагувати</span>
                      </Button>
                    }
                  />
                  <DeleteNewsButton id={post.id} title={post.title} />
                </div>
              </div>
              <p className="whitespace-pre-line text-muted-foreground">{post.body}</p>
            </div>
          );
        })}
      </div>
      <LoadMore
        shown={posts.length}
        total={total}
        href={`/admin/news?${new URLSearchParams({
          ...(query ? { q: query } : {}),
          show: String(shown + PAGE_SIZE),
        }).toString()}`}
        label={`Показано ${posts.length} з ${countLabel(total, NEWS_FORMS)}`}
      />
    </div>
  );
}
