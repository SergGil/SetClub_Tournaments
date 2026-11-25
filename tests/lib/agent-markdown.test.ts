import { describe, expect, it } from "vitest";

import { buildHomeMarkdown, buildLlmsTxt } from "@/lib/agent-markdown";
import { HOME_FAQ, HOME_TITLE } from "@/lib/home-about";
import { SITE_NAME } from "@/lib/site";

const SITE_URL = "https://example.test";
const STATS = { tournamentsCount: 22, playersCount: 43, matchesCount: 315 };

function markdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
}

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt(SITE_URL);

  it("follows the llmstxt.org shape: H1 name, blockquote summary, H2 link sections", () => {
    expect(text.startsWith(`# ${SITE_NAME}\n\n> `)).toBe(true);
    expect(text).toContain("\n## Головні сторінки\n");
    expect(text).toMatch(/\n- \[Турніри\]\(https:\/\/example\.test\/tournaments\): /);
  });

  it("uses only absolute links on the site's own origin", () => {
    const links = markdownLinks(text);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(link.startsWith(`${SITE_URL}/`)).toBe(true);
  });

  it("points at the Markdown homepage and the sitemap", () => {
    expect(text).toContain(`(${SITE_URL}/index.md)`);
    expect(text).toContain(`(${SITE_URL}/sitemap.xml)`);
  });
});

describe("buildHomeMarkdown", () => {
  it("mirrors the HTML homepage: title, stats and every question as a heading", () => {
    const markdown = buildHomeMarkdown({ siteUrl: SITE_URL, stats: STATS, updatedAt: null });

    expect(markdown.startsWith(`# ${HOME_TITLE}\n`)).toBe(true);
    expect(markdown).toContain("- 22 турніри зіграно");
    expect(markdown).toContain("- 43 гравці у клубі");
    for (const item of HOME_FAQ) {
      expect(markdown).toContain(`## ${item.question}\n\n${item.answer}\n`);
    }
    for (const link of markdownLinks(markdown)) expect(link.startsWith(`${SITE_URL}/`)).toBe(true);
  });

  it("shows the last-updated date in Kyiv time only when there is one", () => {
    const withDate = buildHomeMarkdown({
      siteUrl: SITE_URL,
      stats: STATS,
      updatedAt: new Date("2026-11-24T22:30:00.000Z"),
    });
    expect(withDate).toContain("Оновлено: 25 листопада 2026 р.");

    const withoutDate = buildHomeMarkdown({ siteUrl: SITE_URL, stats: STATS, updatedAt: null });
    expect(withoutDate).not.toContain("Оновлено");
  });
});
