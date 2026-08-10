"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateKyiv } from "@/lib/date-format";
import { cn } from "@/lib/utils";

export function NewsCard({
  post,
  authorLabel,
}: {
  post: { id: string; title: string; body: string; createdAt: Date; photoUrl?: string | null };
  authorLabel?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  // Whether the clamped body actually overflows - only known once the real
  // (post-hydration) layout runs, so the toggle stays hidden for a post
  // short enough that "Читати повністю" would show more of nothing.
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight);
  }, [post.body]);

  return (
    <Card>
      {post.photoUrl && (
        <div className="relative aspect-video">
          <Image
            src={post.photoUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-base">
            <Link href={`/news/${post.id}`} className="hover:underline">
              {post.title}
            </Link>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatDateKyiv(new Date(post.createdAt))}
            {authorLabel && ` · ${authorLabel}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p
          ref={bodyRef}
          className={cn("whitespace-pre-line text-sm text-muted-foreground", !expanded && "line-clamp-4")}
        >
          {post.body}
        </p>
        {(overflowing || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start text-sm font-medium text-foreground/80 hover:text-foreground hover:underline"
          >
            {expanded ? "Згорнути" : "Читати повністю"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
