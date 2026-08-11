"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * "Load more" footer for a server-rendered list: a link that bumps the
 * `show` count and re-renders the same page with more items, instead of
 * numbered pages. `scroll={false}` keeps the page where it is rather than
 * jumping back to the top on click.
 *
 * Also auto-triggers the same navigation once this footer scrolls near the
 * viewport, so scrolling down reads as "more just keeps appearing" - the
 * button itself stays, both as a manual fallback and as the sentinel element
 * the IntersectionObserver below watches.
 */
export function LoadMore({
  shown,
  total,
  href,
  label,
}: {
  shown: number;
  total: number;
  href: string;
  label: string;
}) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Read through a ref rather than an effect dependency, so the single
  // observer created below (attached once) always sees the latest href/done
  // state without being torn down and recreated on every "load more" - a
  // recreate-per-href approach would disconnect and reconnect the observer
  // right as the next page's sentinel scrolls into view, risking a missed
  // intersection.
  const done = shown >= total;
  const stateRef = useRef({ href, done });
  // Guards against firing the same href twice while a triggered navigation
  // is still in flight and the sentinel remains in view.
  const triggeredHrefRef = useRef<string | null>(null);

  // Refs can't be written during render (see react-hooks/refs) - sync this
  // one in an effect instead, right after each commit, so the observer
  // effect below always reads the latest href/done without needing it in
  // its own dependency array.
  useEffect(() => {
    stateRef.current = { href, done };
  }, [href, done]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const { href, done } = stateRef.current;
        if (done || triggeredHrefRef.current === href) return;
        triggeredHrefRef.current = href;
        router.push(href, { scroll: false });
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // router is a stable singleton from next/navigation - deliberately
    // creating the observer exactly once on mount rather than on every
    // render, same reasoning as search-input.tsx's own router-identity
    // exhaustive-deps suppression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  return (
    <div ref={sentinelRef} className="flex flex-col items-center gap-2 pt-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button variant="outline" render={<Link href={href} scroll={false} />}>
        Завантажити ще
      </Button>
    </div>
  );
}
