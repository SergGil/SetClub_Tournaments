import { prisma } from "@/lib/db";
import { publicPhotoUrl } from "@/lib/r2";

/** Padel twin of queries/photos.ts#getPhotosByTournament. */
export async function getPhotosByPadelTournament(tournamentId: string) {
  const photos = await prisma.padelPhoto.findMany({
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

/** Padel twin of queries/photos.ts#getTournamentsWithPhotos. */
export function getPadelTournamentsWithPhotos() {
  return prisma.padelTournament.findMany({
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
