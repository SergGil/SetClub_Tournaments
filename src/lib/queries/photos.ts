import { prisma } from "@/lib/db";
import { publicPhotoUrl } from "@/lib/r2";

import { getPadelTournamentsWithPhotos } from "./padel-photos";

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

export type GalleryTournamentCard = {
  sport: "TENNIS" | "PADEL";
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  coverKey: string;
  photoCount: number;
};

/** Tennis + Padel tournaments with at least one photo, merged and sorted together by start date - the single feed /gallery renders. */
export async function getTournamentsWithPhotosAcrossSports(): Promise<GalleryTournamentCard[]> {
  const [tennis, padel] = await Promise.all([getTournamentsWithPhotos(), getPadelTournamentsWithPhotos()]);

  const cards: GalleryTournamentCard[] = [
    ...tennis.map((t) => ({
      sport: "TENNIS" as const,
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      coverKey: t.photos[0].key,
      photoCount: t._count.photos,
    })),
    ...padel.map((t) => ({
      sport: "PADEL" as const,
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      coverKey: t.photos[0].key,
      photoCount: t._count.photos,
    })),
  ];

  return cards.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}
