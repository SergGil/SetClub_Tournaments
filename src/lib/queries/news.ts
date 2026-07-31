import { prisma } from "@/lib/db";

const newsPostInclude = {
  author: { select: { name: true, player: { select: { name: true } } } },
} as const;

export function getNewsPosts(limit?: number) {
  return prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: newsPostInclude,
  });
}

export type NewsPostWithAuthor = Awaited<ReturnType<typeof getNewsPosts>>[number];

/** The first `limit` posts (newest first) plus the total count, for a "load more" list. */
export async function getNewsPostsPage(
  limit: number,
): Promise<{ posts: NewsPostWithAuthor[]; total: number }> {
  const [posts, total] = await Promise.all([
    prisma.newsPost.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: newsPostInclude }),
    prisma.newsPost.count(),
  ]);
  return { posts, total };
}

export function getNewsPostById(id: string) {
  return prisma.newsPost.findUnique({ where: { id } });
}
