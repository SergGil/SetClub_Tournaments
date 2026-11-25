import { describe, expect, it } from "vitest";

import { HOME_FAQ, HOME_INTRO, HOME_TITLE, PUBLIC_SECTIONS } from "@/lib/home-about";
import { SITE_NAME } from "@/lib/site";

// The homepage copy is written to an answer-engine contract (docs/SEO.md,
// "AI-готовність"): a scanner like sagbot.app only counts a paragraph as a
// quotable answer when it is 1-2 sentences and 40-320 characters. These
// tests keep a later copy edit from silently breaking that.
function sentenceCount(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length;
}

describe("HOME_TITLE", () => {
  it("is 10-65 characters and starts with the entity name", () => {
    expect(HOME_TITLE.length).toBeGreaterThanOrEqual(10);
    expect(HOME_TITLE.length).toBeLessThanOrEqual(65);
    expect(HOME_TITLE.startsWith(SITE_NAME)).toBe(true);
  });
});

describe("answer paragraphs", () => {
  const paragraphs = [
    { name: "intro", text: HOME_INTRO },
    ...HOME_FAQ.map((item) => ({ name: item.question, text: item.answer })),
  ];

  it.each(paragraphs)("$name: 40-320 characters, at most 2 sentences", ({ text }) => {
    expect(text.length).toBeGreaterThanOrEqual(40);
    expect(text.length).toBeLessThanOrEqual(320);
    expect(sentenceCount(text)).toBeLessThanOrEqual(2);
  });

  it("avoids abbreviations a naive sentence splitter would count as sentence ends", () => {
    for (const { text } of paragraphs) {
      expect(text).not.toMatch(/(^|\s)(м|обл|вул)\.\s/);
    }
  });

  it("has unique questions", () => {
    const questions = HOME_FAQ.map((item) => item.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe("PUBLIC_SECTIONS", () => {
  it("covers every page a homepage answer links to", () => {
    const paths = new Set(PUBLIC_SECTIONS.map((section) => section.path));
    for (const item of HOME_FAQ) {
      if (item.link) expect(paths).toContain(item.link.href);
    }
  });

  it("never lists admin-only, auth or API paths", () => {
    for (const { path } of PUBLIC_SECTIONS) {
      expect(path).not.toMatch(/^\/(padel|admin|api|login)(\/|$)/);
    }
  });
});
