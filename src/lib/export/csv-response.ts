import { NextResponse } from "next/server";

const UTF8_BOM = String.fromCharCode(0xfeff);

/** Wraps a CSV string as a downloadable file response, BOM-prefixed so Excel opens it as UTF-8. */
export function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
