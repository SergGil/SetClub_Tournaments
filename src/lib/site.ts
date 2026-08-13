export const SITE_NAME = "SET.club";
export const SITE_DESCRIPTION =
  "SET.club — місцевий тенісний клуб у м. Південне, Одеська обл.: турніри, статистика та результати учасників.";

export const SITE_PHONE = "+380 93 313 27 05";
export const SITE_PHONE_TEL = "tel:+380933132705";

export const NAV_LINKS = [
  { href: "/tournaments", label: "Турніри" },
  { href: "/tennis/pricing", label: "Ціни" },
  { href: "/tennis/coaches", label: "Тренери" },
  { href: "/matches", label: "Матчі" },
  { href: "/leaderboard", label: "Статистика" },
  { href: "/rating", label: "Рейтинг" },
  { href: "/players", label: "Гравці" },
  { href: "/news", label: "Новини" },
  { href: "/gallery", label: "Фото" },
] as const;

// /coffee is its own hub (docs/HOMEPAGE.md), unrelated to the Tennis nav
// above - it gets a single self-link instead of the full Tennis link set.
export const COFFEE_NAV_LINKS = [{ href: "/coffee", label: "Меню" }] as const;
// Padel now has its own Tournaments/Matches/Statistics/Rating pages, mirroring
// the Tennis nav - see nav.tsx's hasPadelAdminAccess gate, which still keeps
// this whole list empty for everyone who isn't a superadmin/Padel-domain admin.
export const PADEL_NAV_LINKS = [
  { href: "/padel/tournaments", label: "Турніри" },
  { href: "/padel/matches", label: "Матчі" },
  { href: "/padel/leaderboard", label: "Статистика" },
  { href: "/padel/rating", label: "Рейтинг" },
] as const;

export const ADMIN_NAV_LINK = { href: "/admin", label: "Адмін-панель" } as const;
