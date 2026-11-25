type MediaRange = { type: string; q: number };

/** "text/markdown;q=0.5, *\/*;q=0.1" -> [{ type: "text/markdown", q: 0.5 }, { type: "*\/*", q: 0.1 }]. */
function parseAccept(header: string): MediaRange[] {
  return header.split(",").flatMap((part) => {
    const [range, ...params] = part.split(";").map((piece) => piece.trim());
    if (!range) return [];
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((piece) => piece.trim());
      if (key?.toLowerCase() !== "q") continue;
      const parsed = Number(value);
      // A malformed q is ignored rather than trusted (RFC 9110 allows 0-1, up to 3 decimals).
      if (value && Number.isFinite(parsed)) q = Math.min(Math.max(parsed, 0), 1);
    }
    return [{ type: range.toLowerCase(), q }];
  });
}

/** RFC 9110 12.5.1: the most specific range that matches decides the quality (type/subtype > type/* > *\/*). */
function qualityOf(ranges: MediaRange[], type: string): number {
  const [main] = type.split("/");
  return (
    ranges.find((range) => range.type === type)?.q ??
    ranges.find((range) => range.type === `${main}/*`)?.q ??
    ranges.find((range) => range.type === "*/*")?.q ??
    0
  );
}

/**
 * Whether a request for `/` should get the Markdown homepage instead of HTML
 * (src/proxy.ts). Only an explicit `text/markdown` counts - `*\/*` or `text/*`
 * alone mean "anything", and HTML stays the default. A tie goes to Markdown,
 * since the client named it outright; `text/markdown;q=0` (an explicit "never")
 * or a higher q for HTML keeps HTML.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranges = parseAccept(accept);
  const markdown = ranges.find((range) => range.type === "text/markdown");
  if (!markdown || markdown.q === 0) return false;
  return markdown.q >= qualityOf(ranges, "text/html");
}
