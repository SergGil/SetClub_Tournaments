import { prisma } from "@/lib/db";

export function getNewsPosts(limit?: number) {
  return prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: { name: true, player: { select: { name: true } } } },
    },
  });
}

export function getNewsPostById(id: string) {
  return prisma.newsPost.findUnique({ where: { id } });
}
