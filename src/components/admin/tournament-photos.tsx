import { PhotoUploadDialog } from "@/components/admin/photo-upload-dialog";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { GalleryPhoto } from "@/components/photo-lightbox";
import { deletePhotoAction, setTournamentCoverPhotoAction } from "@/lib/actions/photos";

/**
 * The admin tournament page's "Фото" tab: upload plus the same grid/lightbox
 * the public tournament page shows, with delete enabled. The public page
 * keeps its own copy of the upload button (src/app/tournaments/[id]/page.tsx)
 * - this is just a second place to reach the same flow from "Керувати".
 */
export function TournamentPhotos({ tournamentId, photos }: { tournamentId: string; photos: GalleryPhoto[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Фото показуються в галереї турніру та в розділі «Фото».
        </p>
        <PhotoUploadDialog tournamentId={tournamentId} />
      </div>
      {photos.length === 0 ? (
        <p className="text-foreground/80">Фото ще немає.</p>
      ) : (
        <PhotoLightbox
          photos={photos}
          canManage
          deleteAction={deletePhotoAction}
          setCoverAction={setTournamentCoverPhotoAction}
        />
      )}
    </div>
  );
}
