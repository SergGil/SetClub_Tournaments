import { HomeFooter } from "@/components/home-footer";
import { HomeGallery } from "@/components/home-gallery";
import { HomeMarquee } from "@/components/home-marquee";
import { HomeStats } from "@/components/home-stats";
import { TripleSplit } from "@/components/triple-split";
import { auth } from "@/lib/auth";
import { getAdminScope } from "@/lib/permissions";
import { getHomeGalleryPhotos } from "@/lib/queries/home-gallery";
import { getHomePanelSettings } from "@/lib/queries/home-panels";
import { getHomeStats } from "@/lib/queries/home-stats";
import { getTournamentsWithPhotosAcrossSports } from "@/lib/queries/photos";

const GALLERY_TEASER_SIZE = 6;

export default async function HomePage() {
  const [session, panelText, stats, gallery, curatedPhotos] = await Promise.all([
    auth(),
    getHomePanelSettings(),
    getHomeStats(),
    getTournamentsWithPhotosAcrossSports(GALLERY_TEASER_SIZE),
    getHomeGalleryPhotos(),
  ]);
  const { isSuperAdmin, domains } = getAdminScope(session);
  const padelAuthorized = isSuperAdmin || domains.includes("PADEL");

  return (
    <div className="relative -mx-[50vw] -my-8 left-1/2 right-1/2 w-screen">
      <TripleSplit padelAuthorized={padelAuthorized} panelText={panelText} />
      <HomeMarquee />
      <HomeStats stats={stats} />
      <HomeGallery curatedPhotos={curatedPhotos} tournaments={gallery.tournaments} />
      <HomeFooter />
    </div>
  );
}
