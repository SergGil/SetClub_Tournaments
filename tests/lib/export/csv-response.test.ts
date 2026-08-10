import { describe, expect, it } from "vitest";

import { csvResponse } from "@/lib/export/csv-response";

describe("csvResponse", () => {
  it("BOM-prefixes the body so Excel opens it as UTF-8", async () => {
    // .text() decodes via TextDecoder, which strips a leading BOM by design -
    // check the raw bytes instead to actually confirm it's on the wire.
    const response = csvResponse("a,b\n1,2", "export.csv");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("a,b\n1,2");
  });

  it("sets the CSV content type and an ASCII-safe attachment filename", () => {
    const response = csvResponse("a,b", "export.csv");
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="export.csv"; filename*=UTF-8\'\'export.csv',
    );
  });

  it("does not throw for a non-ASCII filename, and still names the download something sane", () => {
    // A raw Content-Disposition with a Cyrillic filename isn't just
    // mis-displayed - it throws (Headers values must be valid Latin-1
    // ByteStrings), which would 500 the whole export route.
    const response = csvResponse("a,b", "матчі.csv");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="_____.csv"; filename*=UTF-8\'\'%D0%BC%D0%B0%D1%82%D1%87%D1%96.csv',
    );
  });
});
