import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateKyiv } from "@/lib/date-format";
import { getNewsPostById } from "@/lib/queries/news";
import { publicPhotoUrl } from "@/lib/r2";
import { excerpt } from "@/lib/text-excerpt";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getNewsPostById(id);
  if (!post) return { title: "Новина" };

  // Only overrides the site-wide default openGraph (see layout.tsx) when
  // this post actually has a cover photo - a post without one falls through
  // to that default image/description instead of a broken/empty og:image.
  if (!post.photoKey) return { title: post.title, description: excerpt(post.body) };

  const description = excerpt(post.body);
  const image = publicPhotoUrl(post.photoKey);
  return {
    title: post.title,
    description,
    openGraph: { title: post.title, description, images: [{ url: image, alt: post.title }] },
    twitter: { card: "summary_large_image", title: post.title, description, images: [image] },
  };
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
        {post.photoKey && (
          <div className="relative aspect-video">
            <Image
              src={publicPhotoUrl(post.photoKey)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        )}
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <CardTitle className="text-xl">{post.title}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {formatDateKyiv(new Date(post.createdAt))} ·{" "}
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
