"use client";

import { useEffect } from "react";

/**
 * Next.js App Router's own scroll-restoration decides whether to reset
 * scroll on navigation by checking if the new page's root segment already
 * looks "in view" at the OLD scroll position - a check that depends on the
 * exact viewport height and can misfire (confirmed happening in an installed
 * PWA's standalone window, which has no browser chrome eating into that
 * height, when opening a tournament reached by scrolling deep into the
 * list), leaving the page opened mid-scroll instead of at the top. This
 * forces the reset explicitly instead of trusting that heuristic.
 * `resetKey` (e.g. the tournament id) makes it re-fire on every navigation
 * between different instances of the route, not just on first mount.
 */
export function ScrollToTopOnMount({ resetKey }: { resetKey: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [resetKey]);
  return null;
}
