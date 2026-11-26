import { describe, expect, it } from "vitest";

import { PUBLIC_SECTIONS } from "@/lib/home-about";
import { DEFAULT_SHARE_IMAGE, sectionPageMetadata, SECTION_SEO } from "@/lib/section-seo";
import { SITE_NAME } from "@/lib/site";
import { TENNIS_COACHES } from "@/lib/tennis-coaches";
import { TENNIS_PRICES } from "@/lib/tennis-pricing";

const sections = Object.entries(SECTION_SEO).map(([key, seo]) => ({ key, ...seo }));

describe("SECTION_SEO", () => {
  // Google cuts titles off around 60-65 characters and descriptions around 160.
  it.each(sections)("$key: title fits with the brand, description fits too", ({ title, description }) => {
    const fullTitle = `${title} · ${SITE_NAME}`;
    expect(fullTitle.length).toBeGreaterThanOrEqual(10);
    expect(fullTitle.length).toBeLessThanOrEqual(65);
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("names the town in every title - that's what local searches contain", () => {
    for (const { title } of sections) expect(title).toMatch(/Південн/);
  });

  it("has a different title and description on every page", () => {
    expect(new Set(sections.map((s) => s.title)).size).toBe(sections.length);
    expect(new Set(sections.map((s) => s.description)).size).toBe(sections.length);
  });

  it("only describes pages that are listed as public sections", () => {
    const publicPaths = PUBLIC_SECTIONS.map((section) => section.path);
    for (const { path } of sections) expect(publicPaths).toContain(path);
  });

  // The pricing description says "/год" for every item.
  it("only quotes hourly prices", () => {
    for (const price of TENNIS_PRICES) expect(price.unit).toMatch(/^1 година/);
  });

  it("names every coach on the coaches page", () => {
    for (const coach of TENNIS_COACHES) expect(SECTION_SEO.coaches.description).toContain(coach.name);
  });
});

describe("sectionPageMetadata", () => {
  const metadata = sectionPageMetadata(SECTION_SEO.pricing);

  it("sets the title (the layout adds the brand), description and canonical", () => {
    expect(metadata.title).toBe("Оренда тенісного корту в Південному — ціни");
    expect(metadata.description).toBe(SECTION_SEO.pricing.description);
    expect(metadata.alternates).toEqual({ canonical: "/tennis/pricing" });
  });

  // Next merges metadata shallowly, so a page's openGraph replaces the
  // layout's whole object - site name, locale and image must be restated.
  it("restates the full link preview, not just the title", () => {
    expect(metadata.openGraph).toMatchObject({
      siteName: SITE_NAME,
      locale: "uk_UA",
      url: "/tennis/pricing",
      title: `Оренда тенісного корту в Південному — ціни · ${SITE_NAME}`,
      description: SECTION_SEO.pricing.description,
      images: [DEFAULT_SHARE_IMAGE],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] });
  });
});
