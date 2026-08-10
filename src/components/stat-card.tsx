import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  positive: "text-primary",
  negative: "text-destructive",
} as const;

export function StatCard({
  label,
  value,
  tone,
  href,
  active,
}: {
  label: string;
  value: string | number;
  /** Colors the value the same way MatchSummary badges wins/losses - only for stats where "up" is unambiguously good or bad (wins/losses), not neutral counts. */
  tone?: "positive" | "negative";
  /** Makes the whole card a link (e.g. toggling a filter) instead of a plain display tile. */
  href?: string;
  /** Highlights the card as the currently active filter - only meaningful together with `href`. */
  active?: boolean;
}) {
  const content = (
    <CardContent className="p-4">
      <p className={cn("text-2xl font-bold", tone && TONE_CLASS[tone])}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  );

  if (!href) {
    return <Card>{content}</Card>;
  }

  return (
    <Card
      className={cn(
        "transition-colors hover:border-primary",
        active && "border-primary ring-1 ring-primary/30",
      )}
    >
      <Link href={href} aria-current={active ? "true" : undefined}>
        {content}
      </Link>
    </Card>
  );
}
