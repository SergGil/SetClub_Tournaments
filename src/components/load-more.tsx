import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * "Load more" footer for a server-rendered list: a link that bumps the
 * `show` count and re-renders the same page with more items, instead of
 * numbered pages. `scroll={false}` keeps the page where it is rather than
 * jumping back to the top on click.
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
  if (shown >= total) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button variant="outline" render={<Link href={href} scroll={false} />}>
        Завантажити ще
      </Button>
    </div>
  );
}
