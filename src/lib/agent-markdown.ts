import { formatLongDateKyiv } from "@/lib/date-format";
import { HOME_FAQ, HOME_INTRO, HOME_TITLE, isExternalHref, PUBLIC_SECTIONS } from "@/lib/home-about";
import { homeStatItems } from "@/lib/home-stat-items";
import type { HomeStats } from "@/lib/queries/home-stats";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PHONE, SOCIAL_PROFILES } from "@/lib/site";

/**
 * Markdown copies of the site for AI agents (docs/SEO.md, "AI-готовність"):
 * `/llms.txt` (llmstxt.org - what the site is and where its key pages are)
 * and `/index.md` (the homepage as Markdown; also what `/` returns for
 * an Accept header preferring Markdown, see src/proxy.ts). Both built from the
 * same constants as the HTML homepage (home-about.ts), so they can't drift
 * from what a visitor sees. Every link is absolute - agents often read these
 * files out of context, with no base URL to resolve a relative one against.
 */

const MARKDOWN_PATH = "/index.md";

function sectionLinks(siteUrl: string): string[] {
  return PUBLIC_SECTIONS.map(({ path, label, description }) => `- [${label}](${siteUrl}${path}): ${description}`);
}

function contactLines(): string[] {
  return [
    `- Телефон: ${SITE_PHONE}`,
    ...SOCIAL_PROFILES.map(({ label, url }) => `- ${label}: ${url}`),
  ];
}

export function buildLlmsTxt(siteUrl: string): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    HOME_INTRO,
    "",
    `Сайт українською мовою. Корт і тренування бронюються, а в школу тенісу записуються за телефоном клубу ${SITE_PHONE}.`,
    "",
    "## Головні сторінки",
    "",
    `- [Головна](${siteUrl}/): про клуб, відповіді на часті запитання, клуб у цифрах`,
    ...sectionLinks(siteUrl),
    "",
    "## Контакти",
    "",
    ...contactLines(),
    "",
    "## Optional",
    "",
    `- [Головна сторінка в Markdown](${siteUrl}${MARKDOWN_PATH}): той самий текст головної, без HTML`,
    `- [Карта сайту](${siteUrl}/sitemap.xml): усі турніри, гравці, новини та фотоальбоми`,
    "",
  ].join("\n");
}

export function buildHomeMarkdown({
  siteUrl,
  stats,
  updatedAt,
}: {
  siteUrl: string;
  stats: HomeStats;
  updatedAt: Date | null;
}): string {
  const faq = HOME_FAQ.flatMap(({ question, answer, link }) => [
    `## ${question}`,
    "",
    answer,
    "",
    ...(link ? [`[${link.label}](${isExternalHref(link.href) ? link.href : `${siteUrl}${link.href}`})`, ""] : []),
  ]);

  return [
    `# ${HOME_TITLE}`,
    "",
    HOME_INTRO,
    "",
    ...(updatedAt ? [`Оновлено: ${formatLongDateKyiv(updatedAt)}`, ""] : []),
    "## Клуб у цифрах",
    "",
    ...homeStatItems(stats).map(({ value, label }) => `- ${value} ${label}`),
    "",
    ...faq,
    "## Розділи сайту",
    "",
    ...sectionLinks(siteUrl),
    "",
    "## Контакти",
    "",
    ...contactLines(),
    "",
  ].join("\n");
}
