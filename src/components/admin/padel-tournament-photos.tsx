import { PadelPhotoUploadDialog } from "@/components/admin/padel-photo-upload-dialog";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { GalleryPhoto } from "@/components/photo-lightbox";
import { deletePadelPhotoAction, setPadelTournamentCoverPhotoAction } from "@/lib/actions/padel-photos";

/** Padel twin of tournament-photos.tsx. */
export function PadelTournamentPhotos({ tournamentId, photos }: { tournamentId: string; photos: GalleryPhoto[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Фото показуються в галереї турніру та в розділі «Фото».
        </p>
        <PadelPhotoUploadDialog tournamentId={tournamentId} />
      </div>
      {photos.length === 0 ? (
        <p className="text-foreground/80">Фото ще немає.</p>
      ) : (
        <PhotoLightbox
          photos={photos}
          canManage
          deleteAction={deletePadelPhotoAction}
          setCoverAction={setPadelTournamentCoverPhotoAction}
        />
      )}
    </div>
  );
}
