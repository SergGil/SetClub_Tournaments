/**
 * Plain-text excerpt for a meta description / search-result-style snippet -
 * collapses newlines/repeated whitespace to single spaces and cuts to `max`
 * characters (default ~160, the conventional og:description/meta-description
 * length search engines and messengers won't truncate further themselves),
 * appending an ellipsis only when actually cut. Assumes `body` is already
 * plain text (no markdown/HTML to strip) - true for every current caller
 * (NewsPost.body, rendered with `whitespace-pre-line`, not a markdown/HTML
 * renderer).
 */
export function excerpt(body: string, max = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
