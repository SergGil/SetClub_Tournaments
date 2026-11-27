import type { Metadata } from "next";

import { HomeAbout } from "@/components/home-about";
import { HomeFooter } from "@/components/home-footer";
import { HomeGallery } from "@/components/home-gallery";
import { HomeMarquee } from "@/components/home-marquee";
import { HOME_NEWS_COUNT, HomeNews } from "@/components/home-news";
import { HomeStats } from "@/components/home-stats";
import { TripleSplit } from "@/components/triple-split";
import { auth } from "@/lib/auth";
import { HOME_TITLE } from "@/lib/home-about";
import { getAdminScope } from "@/lib/permissions";
import { getHomeGalleryPhotos } from "@/lib/queries/home-gallery";
import { getHomePanelSettings } from "@/lib/queries/home-panels";
import { getContentLastUpdatedAt, getHomeStats } from "@/lib/queries/home-stats";
import { getNewsPosts } from "@/lib/queries/news";
import { getTournamentsWithPhotosAcrossSports } from "@/lib/queries/photos";
import { publicPhotoUrl } from "@/lib/r2";
import { getSiteUrl } from "@/lib/site";
import { buildHomeJsonLd, jsonLdScriptContent } from "@/lib/structured-data";

const GALLERY_TEASER_SIZE = 6;

// Homepage-only on purpose: a canonical in the root layout would point every
// page that doesn't set its own at "/" (docs/SEO.md, "AI-готовність").
export const metadata: Metadata = {
  // `absolute` skips the layout's "%s · SET.club" template - this title already starts with the brand.
  title: { absolute: HOME_TITLE },
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/index.md" },
  },
};

export default async function HomePage() {
  const [session, panelText, stats, news, gallery, curatedPhotos, updatedAt] = await Promise.all([
    auth(),
    getHomePanelSettings(),
    getHomeStats(),
    getNewsPosts(HOME_NEWS_COUNT),
    getTournamentsWithPhotosAcrossSports(GALLERY_TEASER_SIZE),
    getHomeGalleryPhotos(),
    getContentLastUpdatedAt(),
  ]);
  const { isSuperAdmin, domains } = getAdminScope(session);
  const padelAuthorized = isSuperAdmin || domains.includes("PADEL");
  const jsonLd = buildHomeJsonLd({ siteUrl: getSiteUrl(), dateModified: updatedAt });

  return (
    <div className="relative -mx-[50vw] -my-8 left-1/2 right-1/2 w-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(jsonLd) }} />
      <TripleSplit padelAuthorized={padelAuthorized} panelText={panelText} />
      <HomeMarquee />
      <HomeStats stats={stats} />
      <HomeNews
        posts={news.map((post) => ({
          id: post.id,
          title: post.title,
          body: post.body,
          createdAt: post.createdAt,
          photoUrl: post.photoKey ? publicPhotoUrl(post.photoKey) : null,
        }))}
      />
      <HomeGallery curatedPhotos={curatedPhotos} tournaments={gallery.tournaments} />
      <HomeAbout updatedAt={updatedAt} />
      <HomeFooter />
    </div>
  );
}
