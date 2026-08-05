import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3f7a5c",
    // Duplicate maskable-purpose entries reuse the same images:
    // brandIconElement is already full-bleed with centered, comfortably-sized
    // text (see its own comment) - well inside the ~80% "safe zone" Android
    // crops a maskable icon to, so the same image works for both purposes
    // without a redraw. (Next's Manifest type only accepts one `purpose`
    // literal per entry, not the spec's space-separated "any maskable".)
    icons: [
      { src: "/manifest-icons/192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icons/512", sizes: "512x512", type: "image/png" },
      { src: "/manifest-icons/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/manifest-icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
