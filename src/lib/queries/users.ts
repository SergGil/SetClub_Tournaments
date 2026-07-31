import { prisma } from "@/lib/db";

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  createdAt: true,
} as const;

export function getUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: userSelect });
}

export type UserRow = Awaited<ReturnType<typeof getUsers>>[number];

/** The first `limit` users (oldest first) plus the total count, for a "load more" list. */
export async function getUsersPage(limit: number): Promise<{ users: UserRow[]; total: number }> {
  const [users, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: userSelect, take: limit }),
    prisma.user.count(),
  ]);
  return { users, total };
}
