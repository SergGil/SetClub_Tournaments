import { prisma } from "@/lib/db";

export function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
  });
}
