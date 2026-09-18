const WIDTH = 400;
const HEIGHT = 120;
const PADDING = { top: 8, right: 6, bottom: 4, left: 6 };

type Point = { asOfDate: string; rating: number };

// Explicit UTC extraction, not toLocaleDateString - same reasoning as
// RatingHistoryChart's own dateLabel (asOfDate is a UTC midnight timestamp).
function dateLabel(epochMs: number) {
  const d = new Date(epochMs);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

/**
 * Two-series rating-over-time line chart for /rating/compare
 * (docs/DESIGN_ROADMAP_2026.md #6) - same hand-rolled SVG technique as
 * RatingHistoryChart, but two overlaid lines instead of one line + band (two
 * uncertainty bands overlapping would just be visual noise here). Server
 * Component - no click-to-inspect, unlike RatingHistoryChart, since there's
 * no single "active point" that makes sense across two independent series.
 */
export function RatingCompareChart({
  seriesA,
  seriesB,
  colorA = "var(--primary)",
  colorB = "var(--compare-secondary)",
}: {
  seriesA: Point[];
  seriesB: Point[];
  colorA?: string;
  colorB?: string;
}) {
  const all = [...seriesA, ...seriesB];
  if (all.length < 2) return null;

  const dates = all.map((p) => new Date(p.asOfDate).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateSpan = Math.max(1, maxDate - minDate);

  const ratings = all.map((p) => p.rating);
  const minY = Math.min(...ratings);
  const ySpan = Math.max(1, Math.max(...ratings) - minY);

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;
  const xAt = (date: number) => PADDING.left + ((date - minDate) / dateSpan) * innerW;
  const yAt = (value: number) => PADDING.top + innerH - ((value - minY) / ySpan) * innerH;

  const lineFor = (series: Point[]) =>
    series.map((p) => `${xAt(new Date(p.asOfDate).getTime())},${yAt(p.rating)}`).join(" ");
  const lastPoint = (series: Point[]) => {
    const p = series[series.length - 1];
    return { cx: xAt(new Date(p.asOfDate).getTime()), cy: yAt(p.rating) };
  };

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: HEIGHT }}
      >
        {seriesA.length >= 2 && (
          <>
            <polyline points={lineFor(seriesA)} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <circle {...lastPoint(seriesA)} r={3} fill={colorA} />
          </>
        )}
        {seriesB.length >= 2 && (
          <>
            <polyline
              points={lineFor(seriesB)}
              fill="none"
              stroke={colorB}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 3"
            />
            <circle {...lastPoint(seriesB)} r={3} fill={colorB} />
          </>
        )}
      </svg>
      {/* Combined date range of both series (not per-player - the two might
          span different windows) so a viewer can tell whether they're
          looking at a season or several years, same convention as
          RatingHistoryChart's own first/last labels - plus 2 evenly spaced
          points in between so a long span doesn't read as just "sometime
          between these two dates". */}
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        {[0, 1 / 3, 2 / 3, 1].map((fraction) => (
          <span key={fraction}>{dateLabel(minDate + dateSpan * fraction)}</span>
        ))}
      </div>
    </div>
  );
}
