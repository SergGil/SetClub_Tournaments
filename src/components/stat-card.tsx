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
}: {
  label: string;
  value: string | number;
  /** Colors the value the same way MatchSummary badges wins/losses - only for stats where "up" is unambiguously good or bad (wins/losses), not neutral counts. */
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className={cn("text-2xl font-bold", tone && TONE_CLASS[tone])}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
