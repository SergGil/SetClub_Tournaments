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
  barPct,
}: {
  label: string;
  value: string | number;
  /** Colors the value the same way MatchSummary badges wins/losses - only for stats where "up" is unambiguously good or bad (wins/losses), not neutral counts. */
  tone?: "positive" | "negative";
  /** Makes the whole card a link (e.g. toggling a filter) instead of a plain display tile. */
  href?: string;
  /** Highlights the card as the currently active filter - only meaningful together with `href`. */
  active?: boolean;
  /**
   * 0-100 - a thin bar under the label, same visual as the win-rate bar on
   * /leaderboard. The "one comparison alongside the number" half of the 2026
   * dashboard-density convention (docs/DESIGN_ROADMAP_2026.md #4) - only
   * meaningful for a stat that's naturally a share of something (win rate),
   * not a bare count (matches/wins/losses have nothing to bar-chart against).
   */
  barPct?: number;
}) {
  const content = (
    <CardContent className="p-4">
      <p className={cn("text-2xl font-bold tabular-nums", tone && TONE_CLASS[tone])}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {barPct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${barPct}%` }} />
        </div>
      )}
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
