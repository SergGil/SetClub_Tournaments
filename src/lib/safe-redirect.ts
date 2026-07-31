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
