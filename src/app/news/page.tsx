import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNewsPosts } from "@/lib/queries/news";

export const metadata = { title: "Новини" };

export default async function NewsPage() {
  const posts = await getNewsPosts();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Новини клубу</h1>

      {posts.length === 0 && <p className="text-foreground/80">Новин ще немає.</p>}

      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <CardTitle className="text-base">{post.title}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString("uk-UA")} ·{" "}
                  {post.author.player?.name ?? post.author.name}
                </span>
              </div>
            </CardHeader>
            <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
              {post.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
