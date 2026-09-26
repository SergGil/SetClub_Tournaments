import { redirect } from "next/navigation";

import { HomeGalleryUploadDialog } from "@/components/admin/home-gallery-upload-dialog";
import { HomePanelForm } from "@/components/admin/home-panel-form";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { deleteHomeGalleryPhotoAction } from "@/lib/actions/home-gallery";
import { getAdminScope, getSession } from "@/lib/permissions";
import { getHomeGalleryPhotos } from "@/lib/queries/home-gallery";
import { getHomePanelSettings } from "@/lib/queries/home-panels";
import { homePanelDomainValues } from "@/lib/validation/home-panels";

export default async function AdminHomePanelsPage() {
  const { isSuperAdmin, domains } = getAdminScope(await getSession());
  if (!isSuperAdmin && domains.length === 0) {
    redirect("/admin");
  }

  const [settings, galleryPhotos] = await Promise.all([getHomePanelSettings(), getHomeGalleryPhotos()]);
  // Each domain's own admin only edits their own panel - a COFFEE admin
  // never sees the Tennis/Padel forms, even though all three panels live on
  // the shared homepage (see requireDomainAdmin(key) in actions/home-panels.ts).
  const editableKeys = homePanelDomainValues.filter((key) => isSuperAdmin || domains.includes(key));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground/80">
        Текст трьох панелей на головній сторінці сайту (Кава / Теніс / Падел).
      </p>

      <div className="flex flex-col gap-4">
        {editableKeys.map((key) => (
          <HomePanelForm key={key} panelKey={key} {...settings[key]} />
        ))}
      </div>

      {/* Життя клубу: standalone photos for the homepage teaser section
          (src/components/home-gallery.tsx), shared across every domain like
          News rather than gated to a single one - see requireAnyDomainAdmin
          in actions/home-gallery.ts. Not domain-scoped like the panel forms
          above, so it's shown to anyone who reached this page at all. */}
      <div className="flex flex-col gap-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Життя клубу</h2>
            <p className="text-sm text-foreground/80">
              Фото для секції &quot;Життя клубу&quot; на головній — окремо від фотогалерей турнірів.
              Поки тут немає жодного фото, секція показує обкладинки останніх турнірів.
            </p>
          </div>
          <HomeGalleryUploadDialog />
        </div>
        {galleryPhotos.length > 0 && (
          <PhotoLightbox photos={galleryPhotos} canManage deleteAction={deleteHomeGalleryPhotoAction} />
        )}
      </div>
    </div>
  );
}
