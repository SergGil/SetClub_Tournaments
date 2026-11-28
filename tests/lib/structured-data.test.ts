import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HOME_FAQ, HOME_TITLE } from "@/lib/home-about";
import { SITE_NAME } from "@/lib/site";
import { buildHomeJsonLd, HOME_PRIMARY_IMAGE, jsonLdScriptContent } from "@/lib/structured-data";

const SITE_URL = "https://example.test";

type Node = Record<string, unknown>;

/** Width/height from a JPEG's SOFn header - enough to check a file in public/. */
function jpegSize(file: Buffer): { width: number; height: number } {
  let offset = 2; // past the SOI marker
  while (offset < file.length) {
    const marker = file[offset + 1];
    const length = file.readUInt16BE(offset + 2);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: file.readUInt16BE(offset + 5), width: file.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("no SOF marker");
}

function nodeOfType(graph: Node[], type: string): Node {
  const node = graph.find((n) => n["@type"] === type);
  if (!node) throw new Error(`no ${type} node`);
  return node;
}

describe("buildHomeJsonLd", () => {
  const jsonLd = buildHomeJsonLd({ siteUrl: SITE_URL, dateModified: new Date("2026-11-24T10:00:00.000Z") });
  const graph = jsonLd["@graph"] as Node[];

  it("describes the club as an Organization named exactly SITE_NAME", () => {
    const org = nodeOfType(graph, "Organization");
    expect(org).toMatchObject({ "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: `${SITE_URL}/` });
    expect(org.logo).toMatchObject({ url: `${SITE_URL}/manifest-icons/512` });
    expect(org.telephone).toBe("+380933132705");
  });

  // Two is the minimum entity-linking scanners (sagbot.app) accept for sameAs.
  it("lists at least two sameAs profiles as absolute https URLs", () => {
    const sameAs = nodeOfType(graph, "Organization").sameAs as string[];
    expect(sameAs.length).toBeGreaterThanOrEqual(2);
    for (const url of sameAs) expect(url).toMatch(/^https:\/\//);
  });

  it("links WebSite.publisher and the page's author to the Organization by @id", () => {
    const orgRef = { "@id": `${SITE_URL}/#org` };
    expect(nodeOfType(graph, "WebSite")).toMatchObject({ name: SITE_NAME, publisher: orgRef });
    expect(nodeOfType(graph, "FAQPage")).toMatchObject({
      name: HOME_TITLE,
      author: orgRef,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      dateModified: "2026-11-24T10:00:00.000Z",
    });
  });

  // Google falls back to alternateName when it isn't confident in `name` - the
  // site's own host last, so a *.vercel.app site never ends up labelled "Vercel".
  it("offers alternate site names, ending with the site's own host", () => {
    expect(nodeOfType(graph, "WebSite").alternateName).toEqual(["SET club", "example.test"]);
  });

  // FAQPage markup must match the visible text exactly (schema.org, Google) -
  // so it has to be the same HOME_FAQ the page renders, in the same order.
  it("lists every visible question with its exact visible answer", () => {
    expect(nodeOfType(graph, "FAQPage").mainEntity).toEqual(
      HOME_FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    );
  });

  // Google's hint for the search-result thumbnail - an absolute URL to a real
  // file whose declared size matches it.
  it("points primaryImageOfPage at the café photo, with its real dimensions", () => {
    expect(nodeOfType(graph, "FAQPage").primaryImageOfPage).toEqual({
      "@type": "ImageObject",
      url: `${SITE_URL}/split/coffee.jpg`,
      width: HOME_PRIMARY_IMAGE.width,
      height: HOME_PRIMARY_IMAGE.height,
    });
    const file = readFileSync(path.join(process.cwd(), "public", HOME_PRIMARY_IMAGE.path));
    expect(jpegSize(file)).toEqual({ width: HOME_PRIMARY_IMAGE.width, height: HOME_PRIMARY_IMAGE.height });
  });

  it("leaves dateModified out when there is no date", () => {
    const empty = buildHomeJsonLd({ siteUrl: SITE_URL, dateModified: null });
    expect(nodeOfType(empty["@graph"] as Node[], "FAQPage")).not.toHaveProperty("dateModified");
  });
});

describe("jsonLdScriptContent", () => {
  it("escapes < so the payload can't close its own <script> tag", () => {
    const out = jsonLdScriptContent({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
