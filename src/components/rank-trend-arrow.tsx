import { cn } from "@/lib/utils";

/**
 * "▲2"/"▼1" next to a rank number - how many places this player moved versus
 * the ranking right before the most recently played tournament (see
 * src/lib/rating/rank-trend.ts). Renders nothing for `undefined` (no
 * previous ranking to compare - a debut) or `0` (no visible move) rather
 * than a "±0", which would just be noise on every unchanged row.
 */
export function RankTrendArrow({ delta }: { delta: number | undefined }) {
  if (!delta) return null;
  return (
    <span
      className={cn(
        "ml-1 text-xs font-medium tabular-nums",
        delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500",
      )}
    >
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
