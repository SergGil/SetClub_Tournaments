const WIDTH = 400;
const HEIGHT = 120;
const PADDING = { top: 8, right: 6, bottom: 4, left: 6 };

type Point = { asOfDate: string; rating: number };

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
  colorB = "var(--home-accent)",
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
  const dateSpan = Math.max(1, Math.max(...dates) - minDate);

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
  );
}
