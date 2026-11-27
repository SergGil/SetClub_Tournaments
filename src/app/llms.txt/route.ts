import { buildLlmsTxt } from "@/lib/agent-markdown";
import { getSiteUrl } from "@/lib/site";

// No DB reads, so prerendered at build - getSiteUrl() already knows it's on
// Vercel then (robots.txt relies on the same).
export const dynamic = "force-static";

/** llmstxt.org summary of the site for AI agents - see src/lib/agent-markdown.ts. */
export function GET() {
  return new Response(buildLlmsTxt(getSiteUrl()), {
    // text/plain rather than text/markdown so a browser shows it instead of downloading it.
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
