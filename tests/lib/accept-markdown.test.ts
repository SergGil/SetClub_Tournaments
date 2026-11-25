import { describe, expect, it } from "vitest";

import { prefersMarkdown } from "@/lib/accept-markdown";

describe("prefersMarkdown", () => {
  it.each([
    ["text/markdown"],
    ["text/markdown; charset=utf-8"],
    ["Text/Markdown"],
    ["text/markdown, text/html;q=0.9"],
    ["text/markdown, */*"], // tie with */* - the client named Markdown outright
    ["text/markdown;q=0.9, text/html;q=0.9"],
    ["text/markdown;q=0.5, application/json"],
  ])("serves Markdown for %j", (accept) => {
    expect(prefersMarkdown(accept)).toBe(true);
  });

  it.each([
    [null],
    [""],
    // A real browser's header.
    ["text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"],
    ["*/*"],
    ["text/*"],
    ["text/markdown;q=0"], // explicit "never"
    ["text/markdown;q=0.0, text/html"],
    ["text/html, text/markdown;q=0.5"], // HTML preferred
    ["text/markdown;q=0.5, text/*"], // text/* covers HTML at q=1
    ["text/markdown;q=0.3, */*;q=0.8"],
  ])("keeps HTML for %j", (accept) => {
    expect(prefersMarkdown(accept)).toBe(false);
  });

  it("ignores a malformed q instead of trusting it", () => {
    expect(prefersMarkdown("text/markdown;q=abc, text/html;q=0.5")).toBe(true);
  });
});
