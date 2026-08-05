import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateUTC } from "@/lib/date-format";
import { getNewsPostById } from "@/lib/queries/news";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getNewsPostById(id);
  return { title: post?.title ?? "Новина" };
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getNewsPostById(id);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/news" className="text-sm text-foreground/80 hover:text-foreground">
        ← Усі новини
      </Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <CardTitle className="text-xl">{post.title}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {formatDateUTC(new Date(post.createdAt))} ·{" "}
              {post.author.player?.name ?? post.author.name}
            </span>
          </div>
        </CardHeader>
        <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
          {post.body}
        </CardContent>
      </Card>
    </div>
  );
}
