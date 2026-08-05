"use client";

import { useState } from "react";

import type { RatingHistoryPoint } from "@/lib/rating/ratings-data";

const HISTORY_CHART_WIDTH = 400;
const HISTORY_CHART_HEIGHT = 96;
const HISTORY_CHART_PADDING = { top: 10, right: 6, bottom: 4, left: 6 };

// Explicit UTC extraction, not toLocaleDateString: asOfDate is a UTC
// midnight timestamp, and this is a Client Component (it hydrates) - using
// the local timezone would format differently during SSR (server's zone)
// than during hydration (visitor's zone), producing a mismatched string
// whenever those differ (e.g. Vercel's UTC vs. a Ukraine-timezone visitor).
function dateLabel(iso: string) {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

/**
 * Rating-over-time line chart with an uncertainty band (±spread) - hand-rolled
 * SVG, no chart library, consistent with the bar chart and strip plot
 * elsewhere in the app. Tapping/clicking a point shows its exact value in the
 * line below (defaults to the latest point) - a native `<title>` tooltip
 * would have worked for mouse hover but never fires on touch, so points get
 * an actual click handler plus an oversized invisible hit-circle instead.
 */
export function RatingHistoryChart({ points }: { points: RatingHistoryPoint[] }) {
  const [activeIndex, setActiveIndex] = useState(points.length - 1);

  const dates = points.map((p) => new Date(p.asOfDate).getTime());
  const minDate = dates[0];
  const dateSpan = Math.max(1, dates[dates.length - 1] - minDate);

  const low = points.map((p) => p.rating - p.spread);
  const high = points.map((p) => p.rating + p.spread);
  const minY = Math.min(...low);
  const maxY = Math.max(...high);
  const ySpan = Math.max(1, maxY - minY);

  const innerW = HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING.left - HISTORY_CHART_PADDING.right;
  const innerH = HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING.top - HISTORY_CHART_PADDING.bottom;

  const xAt = (date: number) => HISTORY_CHART_PADDING.left + ((date - minDate) / dateSpan) * innerW;
  const yAt = (value: number) =>
    HISTORY_CHART_PADDING.top + innerH - ((value - minY) / ySpan) * innerH;

  const linePoints = points.map((p) => `${xAt(new Date(p.asOfDate).getTime())},${yAt(p.rating)}`).join(" ");
  const bandTop = points.map((p) => `${xAt(new Date(p.asOfDate).getTime())},${yAt(p.rating + p.spread)}`);
  const bandBottom = [...points]
    .reverse()
    .map((p) => `${xAt(new Date(p.asOfDate).getTime())},${yAt(p.rating - p.spread)}`);

  const active = points[activeIndex];

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full text-primary"
        style={{ height: HISTORY_CHART_HEIGHT }}
      >
        <polygon points={[...bandTop, ...bandBottom].join(" ")} className="fill-current opacity-10" />
        <polyline points={linePoints} fill="none" className="stroke-current" strokeWidth={2} />
        {points.map((p, i) => {
          const cx = xAt(new Date(p.asOfDate).getTime());
          const cy = yAt(p.rating);
          return (
            <g key={p.tournamentId}>
              {/* Oversized, invisible hit target - the visible dot below is
                  too small to reliably tap on a phone screen. */}
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill="transparent"
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={i === activeIndex ? 4 : i === points.length - 1 ? 3.5 : 2}
                className="fill-current pointer-events-none"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span>{dateLabel(points[0].asOfDate)}</span>
        <span className="font-medium text-foreground">
          {dateLabel(active.asOfDate)}: {active.rating} ±{active.spread}
        </span>
        <span>{dateLabel(points[points.length - 1].asOfDate)}</span>
      </div>
    </div>
  );
}
