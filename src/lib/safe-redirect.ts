/**
 * Only ever redirect back to a relative same-origin path. `callbackUrl` comes
 * straight from the query string, so an unvalidated redirect() call here
 * would let a crafted link (?callbackUrl=https://evil.example) send an
 * already-signed-in user to an external site - a classic open-redirect.
 * Browsers treat backslashes in a path as forward slashes when resolving a
 * URL, so "/\/evil.example" resolves to "https://evil.example" even though
 * it doesn't literally start with "//" or contain "://" - reject any
 * backslash too.
 */
export function safeCallbackPath(url: string | undefined): string {
  if (
    url &&
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("://") &&
    !url.includes("\\")
  ) {
    return url;
  }
  return "/";
}

/**
 * Request header src/proxy.ts sets on every /admin request that carries a
 * session cookie: the page asked for (path + query). The admin layout can't
 * see its own URL, so without it a stale session sent the admin to
 * /login?callbackUrl=/admin and the page they had opened (a shared
 * /admin/tournaments/... link) was lost. Overwritten by the proxy on every
 * /admin request, and still passed through safeCallbackPath by /login.
 */
export const ADMIN_PATH_HEADER = "x-setclub-admin-path";
