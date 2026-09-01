export const SITE_NAME = "SET.club";
// Was "місцевий тенісний клуб" (tennis-only) - stale since Coffee shipped
// and Padel became part of the club's public identity (home-footer.tsx's
// own "Теніс · Кава · Падел" tagline), not just an internal admin-only
// section. This string feeds every page's default <meta description> and
// social-preview og:description/twitter:description (see layout.tsx) - it's
// the first thing anyone sees sharing a bare link to the site.
export const SITE_DESCRIPTION =
  "SET.club — теніс, кава та падел у м. Південне, Одеська обл.: турніри, статистика та результати учасників.";

export const SITE_PHONE = "+380 93 313 27 05";
export const SITE_PHONE_TEL = "tel:+380933132705";

/**
 * Canonical production origin (no trailing slash) - for metadataBase
 * (src/app/layout.tsx) and the absolute URLs sitemap.ts/robots.ts must
 * emit. Resolved from Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` (the
 * project's actual production domain - custom domain if one's attached,
 * otherwise the `*.vercel.app` one; set in every environment, including
 * preview deploys) rather than a hand-maintained env var, so it can never
 * drift from whatever domain the project is really deployed at. Falls back
 * to localhost for `next dev`/a local `next build`, where that var isn't set.
 */
export function getSiteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

export const NAV_LINKS = [
  // exact: true so this doesn't stay lit up as "active" on every other Tennis
  // page too (all of them start with "/", which itself isn't a prefix issue,
  // but /tennis/pricing and /tennis/coaches below DO start with "/tennis" -
  // see useIsActive in nav-links.tsx). Also the fix for "no way back to the
  // /tennis hub screen from e.g. /tournaments without going through the
  // triple-split homepage first" (docs/HOMEPAGE.md).
  { href: "/tennis", label: "Теніс", exact: true },
  { href: "/tennis/pricing", label: "Ціни" },
  { href: "/tennis/coaches", label: "Тренери" },
  { href: "/tournaments", label: "Турніри" },
  { href: "/matches", label: "Матчі" },
  { href: "/leaderboard", label: "Статистика" },
  { href: "/rating", label: "Рейтинг" },
  { href: "/players", label: "Гравці" },
  { href: "/news", label: "Новини" },
  { href: "/gallery", label: "Фото" },
] as const;

// /news and /gallery are club-wide, not Tennis-specific (/gallery already
// merges Tennis + Padel tournament photos into one feed - see
// getTournamentsWithPhotosAcrossSports in src/lib/queries/photos.ts) - every
// hub's nav links to both, not just Tennis's. Tagged with a `?hub=` marker
// (read back by useSectionLinks in nav-links.tsx) so following one from
// Coffee/Padel keeps that hub's own nav list showing instead of silently
// falling back to the Tennis one just because /news and /gallery aren't
// under a /coffee or /padel path prefix themselves.

// /coffee is its own hub (docs/HOMEPAGE.md), unrelated to the Tennis nav
// above - it gets a single self-link plus the two club-wide sections instead
// of the full Tennis link set.
export const COFFEE_NAV_LINKS = [
  { href: "/coffee", label: "Меню" },
  { href: "/news?hub=coffee", label: "Новини" },
  { href: "/gallery?hub=coffee", label: "Фото" },
] as const;
// Padel now has its own Tournaments/Matches/Statistics/Rating pages, mirroring
// the Tennis nav - see nav.tsx's hasPadelAdminAccess gate, which still keeps
// this whole list empty for everyone who isn't a superadmin/Padel-domain admin.
export const PADEL_NAV_LINKS = [
  // Same "exact" reasoning as "/tennis" above - without it, this would show
  // active on every /padel/* subpage (they all start with "/padel").
  { href: "/padel", label: "Падел", exact: true },
  { href: "/padel/tournaments", label: "Турніри" },
  { href: "/padel/matches", label: "Матчі" },
  { href: "/padel/leaderboard", label: "Статистика" },
  { href: "/padel/rating", label: "Рейтинг" },
  { href: "/news?hub=padel", label: "Новини" },
  { href: "/gallery?hub=padel", label: "Фото" },
] as const;

export const ADMIN_NAV_LINK = { href: "/admin", label: "Адмін-панель" } as const;
