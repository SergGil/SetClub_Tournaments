import { prisma } from "@/lib/db";
import { publicPhotoUrl } from "@/lib/r2";

export async function getPhotosByTournament(tournamentId: string) {
  const photos = await prisma.photo.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, key: true, caption: true },
  });

  return photos.map((photo) => ({
    id: photo.id,
    url: publicPhotoUrl(photo.key),
    caption: photo.caption,
  }));
}

/** Tournaments with at least one photo, newest first, each with a cover (its most recent photo) and total count. */
export function getTournamentsWithPhotos() {
  return prisma.tournament.findMany({
    where: { photos: { some: {} } },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      photos: { orderBy: { createdAt: "desc" }, take: 1, select: { key: true } },
      _count: { select: { photos: true } },
    },
  });
}
