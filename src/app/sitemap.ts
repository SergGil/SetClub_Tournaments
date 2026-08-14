import type { MetadataRoute } from "next";

import { getTournamentsWithPhotosAcrossSports } from "@/lib/queries/photos";
import { getPlayers } from "@/lib/queries/players";
import { getPadelTournaments } from "@/lib/queries/padel-tournaments";
import { getNewsPosts } from "@/lib/queries/news";
import { getTournaments } from "@/lib/queries/tournaments";
import { getSiteUrl } from "@/lib/site";

/**
 * `/admin/*` and everything under `/api/*` deliberately excluded (see
 * robots.ts) - not page content, and `/admin` is behind auth anyway.
 * `/login` excluded too - nothing there worth a search result.
 */
const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/tennis", changeFrequency: "weekly", priority: 0.8 },
  { path: "/tournaments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/tennis/pricing", changeFrequency: "monthly", priority: 0.5 },
  { path: "/tennis/coaches", changeFrequency: "monthly", priority: 0.5 },
  { path: "/matches", changeFrequency: "daily", priority: 0.6 },
  { path: "/leaderboard", changeFrequency: "weekly", priority: 0.6 },
  { path: "/rating", changeFrequency: "weekly", priority: 0.6 },
  { path: "/players", changeFrequency: "weekly", priority: 0.6 },
  { path: "/news", changeFrequency: "weekly", priority: 0.6 },
  { path: "/gallery", changeFrequency: "weekly", priority: 0.5 },
  { path: "/coffee", changeFrequency: "monthly", priority: 0.5 },
  { path: "/padel", changeFrequency: "weekly", priority: 0.8 },
  { path: "/padel/tournaments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/padel/matches", changeFrequency: "daily", priority: 0.6 },
  { path: "/padel/leaderboard", changeFrequency: "weekly", priority: 0.6 },
  { path: "/padel/rating", changeFrequency: "weekly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const url = (path: string) => `${siteUrl}${path}`;

  const [tournaments, padelTournaments, players, newsPosts, galleryTournaments] = await Promise.all([
    getTournaments(),
    getPadelTournaments(),
    getPlayers(),
    getNewsPosts(),
    getTournamentsWithPhotosAcrossSports(),
  ]);

  return [
    ...STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
      url: url(path),
      changeFrequency,
      priority,
    })),
    ...tournaments.map((t) => ({
      url: url(`/tournaments/${t.id}`),
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...padelTournaments.map((t) => ({
      url: url(`/padel/tournaments/${t.id}`),
      lastModified: t.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...players.map((p) => ({
      url: url(`/players/${p.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...newsPosts.map((post) => ({
      url: url(`/news/${post.id}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...galleryTournaments.map((t) => ({
      url: url(t.sport === "PADEL" ? `/gallery/padel/${t.id}` : `/gallery/${t.id}`),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
