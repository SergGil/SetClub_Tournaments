import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

/**
 * Two favicons, each emitted as its own `<link rel="icon" sizes=...>`:
 *
 * - `large` (192px, a multiple of 48): the full "SET. club" brand mark, the
 *   same design as the PWA/Apple icons and the club's Instagram avatar. This
 *   is the one Google shows next to search results - it wants a square icon
 *   bigger than 48px, and picks from the homepage's <link rel="icon"> tags.
 * - `small` (32px): a plain "S" in a green circle for browser tabs, where
 *   "SET. club" text would shrink to an unreadable smudge.
 *
 * There is deliberately no app/favicon.ico any more: the create-next-app one
 * (the Vercel triangle) sat there from the first commit, and as the largest
 * declared icon (256px) it would have been Google's pick. /favicon.ico itself
 * is rewritten to the small icon in next.config.ts for clients that request it
 * blindly (non-HTML pages, some link-preview bots).
 */
export function generateImageMetadata() {
  return [
    { id: "large", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "small", size: { width: 32, height: 32 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  if ((await id) === "large") {
    return new ImageResponse(brandIconElement(192), { width: 192, height: 192 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "#3f7a5c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    { width: 32, height: 32 },
  );
}
