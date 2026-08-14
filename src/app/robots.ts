import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

/**
 * `/admin/*` is already behind a real auth check (src/app/admin/layout.tsx)
 * - this is just good crawler hygiene on top of that, not the access-control
 * boundary itself. `/api/*` (presign endpoints, the `/api/share/*` image
 * generators, NextAuth's own routes) isn't page content either - nothing
 * there is meant to rank or show up in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
