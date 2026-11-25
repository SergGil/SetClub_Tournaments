import { getSiteUrl } from "@/lib/site";

// No DB reads, so prerendered at build (as the robots.ts this replaced was).
export const dynamic = "force-static";

/**
 * A route handler rather than the robots.ts metadata convention, because
 * Next's MetadataRoute.Robots type has no room for `Content-Signal`
 * (contentsignals.org): the site's stated preference for how its content may
 * be used - search indexing, AI answers that quote it (ai-input) and model
 * training (ai-train). A preference, not access control; the actual
 * allow/disallow rules below are unchanged.
 *
 * `/admin/*` is already behind a real auth check (src/app/admin/layout.tsx)
 * - disallowing it is crawler hygiene, not the access-control boundary
 * itself. `/api/*` (presign endpoints, the `/api/share/*` image generators,
 * NextAuth's own routes) isn't page content either.
 */
export function GET() {
  const body = [
    "User-Agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "",
    `Sitemap: ${getSiteUrl()}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
