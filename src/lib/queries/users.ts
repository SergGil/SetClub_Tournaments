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

/** The first `limit` users (oldest first, optionally name/email-matching `query`) plus the total count, for a "load more" + search list. */
export async function getUsersPage(
  limit: number,
  query?: string,
): Promise<{ users: UserRow[]; total: number }> {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "asc" }, select: userSelect, take: limit }),
    prisma.user.count({ where }),
  ]);
  return { users, total };
}
