import { PhotoLightbox } from "@/components/photo-lightbox";
import { getPhotosByTournament } from "@/lib/queries/photos";

export async function TournamentGallery({
  tournamentId,
  canManage,
}: {
  tournamentId: string;
  canManage: boolean;
}) {
  const photos = await getPhotosByTournament(tournamentId);

  if (photos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">Фото</h2>
      <PhotoLightbox photos={photos} canManage={canManage} />
    </section>
  );
}
