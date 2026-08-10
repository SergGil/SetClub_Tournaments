import { NextResponse } from "next/server";

const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * A raw non-ASCII `filename="..."` (e.g. a Cyrillic tournament/player name)
 * isn't just mis-displayed - `Headers`/`NextResponse` require header values
 * to be valid ByteStrings (Latin-1), so it throws and 500s the whole export
 * route. `filename` (ASCII-only fallback, quoted-string escaped) covers
 * every client; `filename*` (RFC 5987 percent-encoded UTF-8) is what
 * actually shows the real name in browsers/Excel that support it - all
 * current callers already pass ASCII-only names, but this is a shared
 * helper, so it can't assume every future caller will.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Wraps a CSV string as a downloadable file response, BOM-prefixed so Excel opens it as UTF-8. */
export function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(filename),
    },
  });
}
