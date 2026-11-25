import { buildHomeMarkdown } from "@/lib/agent-markdown";
import { getContentLastUpdatedAt, getHomeStats } from "@/lib/queries/home-stats";
import { getSiteUrl } from "@/lib/site";

// Reads live stats - and the CI build has no real database to prerender against.
export const dynamic = "force-dynamic";

/**
 * The homepage as Markdown, for AI agents. Reached directly at /index.md or
 * via `/` with `Accept: text/markdown` (beforeFiles rewrite in
 * next.config.ts) - which is why it says `Vary: Accept`. The canonical Link
 * points search engines back at the HTML homepage so this copy isn't indexed
 * as a duplicate of it.
 */
export async function GET() {
  const [stats, updatedAt] = await Promise.all([getHomeStats(), getContentLastUpdatedAt()]);
  const siteUrl = getSiteUrl();

  return new Response(buildHomeMarkdown({ siteUrl, stats, updatedAt }), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      Link: `<${siteUrl}/>; rel="canonical"`,
    },
  });
}
