import { SITE_DESCRIPTION } from "@/lib/site";

import { ShareCardBackground, ShareCardFooter, ShareCardHeader, WHITE } from "./card-chrome";

/**
 * Site-wide fallback `og:image`/`twitter:image` (src/app/layout.tsx's
 * `metadata.openGraph.images`) - shown whenever a page doesn't set its own
 * more specific one (a tournament page's real standings card, a news post's
 * own cover photo, etc. - see generateMetadata on those pages). Reuses the
 * same card-chrome.tsx pieces as the match/tournament/season share cards
 * (docs/SHARE_CARDS.md) so a link preview of *any* page still looks like it
 * belongs to the same brand, not a blank/default card.
 */
export function defaultShareCardElement() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        color: WHITE,
      }}
    >
      <ShareCardBackground />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "52px 64px",
        }}
      >
        <ShareCardHeader eyebrow="Клубний сайт" />

        <span style={{ display: "flex", maxWidth: 760, fontSize: 34, fontWeight: 700, color: WHITE }}>
          {SITE_DESCRIPTION}
        </span>

        <ShareCardFooter />
      </div>
    </div>
  );
}
