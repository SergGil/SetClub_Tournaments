const WIDTH = 56;
const HEIGHT = 20;
const PADDING = 2.5;

/**
 * Compact rating-trend line for a table row - last few RatingSnapshot points,
 * no axes/labels/interactivity (see RatingHistoryChart for the full
 * interactive version on the player profile). Pure SVG, no client JS needed.
 * docs/DESIGN_ROADMAP_2026.md #1.
 */
export function RatingSparkline({ points }: { points: { rating: number }[] }) {
  // A single point has no direction to draw, and a flat two-point line at
  // the same rating is possible but rare enough not to special-case.
  if (points.length < 2) return null;

  const values = points.map((p) => p.rating);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const innerH = HEIGHT - PADDING * 2;
  const stepX = values.length > 1 ? (WIDTH - PADDING * 2) / (values.length - 1) : 0;

  const coords = values.map((v, i) => {
    const x = PADDING + i * stepX;
    const y = PADDING + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });
  const last = coords[coords.length - 1];

  const delta = values[values.length - 1] - values[0];
  const color = delta > 0 ? "var(--primary)" : delta < 0 ? "var(--destructive)" : "var(--muted-foreground)";

  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="shrink-0" aria-hidden>
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={2.3} fill={color} />
      </svg>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>
        {delta > 0 ? "+" : ""}
        {delta}
      </span>
    </span>
  );
}
