import { PhotoLightbox } from "@/components/photo-lightbox";
import { deletePadelPhotoAction } from "@/lib/actions/padel-photos";
import { getPhotosByPadelTournament } from "@/lib/queries/padel-photos";

/** Padel twin of tournament-gallery.tsx. */
export async function PadelTournamentGallery({
  tournamentId,
  canManage,
}: {
  tournamentId: string;
  canManage: boolean;
}) {
  const photos = await getPhotosByPadelTournament(tournamentId);

  if (photos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">Фото</h2>
      <PhotoLightbox photos={photos} canManage={canManage} deleteAction={deletePadelPhotoAction} />
    </section>
  );
}
