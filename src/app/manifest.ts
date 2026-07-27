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
    icons: [
      { src: "/manifest-icons/192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
