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
export function getTournamentsWithPhotos(query?: string) {
  return prisma.tournament.findMany({
    where: {
      photos: { some: {} },
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
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

/**
 * Tennis + Padel tournaments with at least one photo, merged and sorted together by start date -
 * the single feed /gallery renders. `shown` slices the merged, sorted feed the same way
 * getTournamentsPage does (see docs/UX_AUDIT_FIXES.md - LoadMore/SearchInput pattern), rather than
 * paginating each sport separately, since the page shows one combined chronological list.
 */
export async function getTournamentsWithPhotosAcrossSports(
  shown?: number,
  query?: string,
): Promise<{ tournaments: GalleryTournamentCard[]; total: number }> {
  const [tennis, padel] = await Promise.all([
    getTournamentsWithPhotos(query),
    getPadelTournamentsWithPhotos(query),
  ]);

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

  cards.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return { tournaments: shown ? cards.slice(0, shown) : cards, total: cards.length };
}
