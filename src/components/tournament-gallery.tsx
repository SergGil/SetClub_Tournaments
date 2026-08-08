import { PhotoLightbox } from "@/components/photo-lightbox";
import { prisma } from "@/lib/db";
import { publicPhotoUrl } from "@/lib/r2";

export async function TournamentGallery({
  tournamentId,
  canManage,
}: {
  tournamentId: string;
  canManage: boolean;
}) {
  const photos = await prisma.photo.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, key: true, caption: true },
  });

  if (photos.length === 0) return null;

  const items = photos.map((photo) => ({
    id: photo.id,
    url: publicPhotoUrl(photo.key),
    caption: photo.caption,
  }));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">Фото</h2>
      <PhotoLightbox photos={items} canManage={canManage} />
    </section>
  );
}
