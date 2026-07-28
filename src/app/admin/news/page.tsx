import { PencilIcon, PlusIcon } from "lucide-react";

import { DeleteNewsButton } from "@/components/admin/delete-news-button";
import { NewsDialog } from "@/components/admin/news-dialog";
import { Button } from "@/components/ui/button";
import { countLabel, NEWS_FORMS } from "@/lib/pluralize";
import { getNewsPosts } from "@/lib/queries/news";

export default async function AdminNewsPage() {
  const posts = await getNewsPosts();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {posts.length > 0 ? countLabel(posts.length, NEWS_FORMS) : "Ще немає жодної новини."}
        </p>
        <NewsDialog
          trigger={
            <Button>
              <PlusIcon /> Нова новина
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {posts.map((post) => (
          <div key={post.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString("uk-UA")} ·{" "}
                  {post.author.player?.name ?? post.author.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NewsDialog
                  post={post}
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
        ))}
      </div>
    </div>
  );
}
