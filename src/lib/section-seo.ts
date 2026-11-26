import type { Metadata } from "next";

import { SITE_NAME, SITE_PHONE } from "@/lib/site";
import { TENNIS_COACHES } from "@/lib/tennis-coaches";
import { BALL_BASKET, BALL_MACHINE, COURT_RENTAL, EQUIPMENT_RENTAL } from "@/lib/tennis-pricing";

export type SectionSeo = {
  /** Route path, also the canonical URL. */
  path: string;
  /** Without the brand - the root layout's template appends " · SET.club". */
  title: string;
  description: string;
};

/**
 * Search titles and descriptions for the club's main public pages
 * (docs/SEO.md, "Заголовки й описи сторінок"). Worded the way people search
 * in Ukrainian ("оренда тенісного корту Південне", "школа тенісу для дітей"),
 * with the town name in every title - a short "Ціни · SET.club" matches
 * nothing anyone types. Titles stay within ~65 characters with the brand and
 * descriptions within ~160, so Google doesn't cut them off
 * (tests/lib/section-seo.test.ts). Facts come from the same constants the
 * pages render (prices, coaches), so a description can't contradict its page.
 */
export const SECTION_SEO = {
  tennis: {
    path: "/tennis",
    title: "Тенісний клуб у Південному: корти, турніри, рейтинг",
    description:
      `Тенісний клуб ${SITE_NAME} у Південному, Одеська обл.: ґрунтові корти, турніри 1×1, 2×2 і змішані, ` +
      "рейтинг гравців, результати матчів і новини клубу.",
  },
  pricing: {
    path: "/tennis/pricing",
    title: "Оренда тенісного корту в Південному — ціни",
    // "/год" for every item: all of TENNIS_PRICES are priced per hour (the test checks their units).
    description:
      `Оренда ґрунтового корту — ${COURT_RENTAL.price}/год, прокат інвентаря — ${EQUIPMENT_RENTAL.price}/год, ` +
      `корзина м'ячів — ${BALL_BASKET.price}/год, тенісна пушка — ${BALL_MACHINE.price}/год. Бронювання: ${SITE_PHONE}.`,
  },
  school: {
    path: "/tennis/school",
    title: "Школа тенісу для дітей у Південному",
    description:
      `Школа тенісу ${SITE_NAME} у Південному набирає дітей від 4 років. Групи формуються за віком, ` +
      `запис за телефоном ${SITE_PHONE}.`,
  },
  coaches: {
    path: "/tennis/coaches",
    title: "Тренери з тенісу в Південному",
    description:
      `Тренери ${SITE_NAME}: ${TENNIS_COACHES.map((coach) => coach.name).join(", ")}. ` +
      `Тренування для гравців будь-якого рівня, запис за телефоном ${SITE_PHONE}.`,
  },
  tournaments: {
    path: "/tournaments",
    title: "Тенісні турніри в Південному: результати",
    description:
      `Тенісні турніри ${SITE_NAME} у Південному: одиночні, парні та змішані формати, сітки, ` +
      "рахунки матчів і підсумкові місця кожного турніру.",
  },
  coffee: {
    path: "/coffee",
    // "матча-меню", never "матчі": on a tennis site that also reads as "matches".
    title: "Кав'ярня в Південному: кава, чай і матча-меню",
    description:
      `Кав'ярня тенісного клубу ${SITE_NAME} у Південному: кава, чай, авторські напої та велике ` +
      "матча-меню. Актуальне меню з цінами.",
  },
} satisfies Record<string, SectionSeo>;

/** The site-wide share image (src/app/api/share/default) - also the root layout's default. */
export const DEFAULT_SHARE_IMAGE = { url: "/api/share/default", width: 1200, height: 630, alt: SITE_NAME };

/**
 * Full metadata for one of SECTION_SEO's pages: title, description,
 * canonical, and link previews. openGraph/twitter must be restated whole -
 * Next merges metadata shallowly per top-level key, so setting any of it here
 * would otherwise drop the layout's site name, locale and image.
 */
export function sectionPageMetadata({ path, title, description }: SectionSeo): Metadata {
  const fullTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "uk_UA",
      url: path,
      title: fullTitle,
      description,
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_SHARE_IMAGE.url],
    },
  };
}
