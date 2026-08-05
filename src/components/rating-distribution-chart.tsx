"use client";

import { useState } from "react";

import type { DistributionPoint } from "@/lib/rating-distribution";
import { layoutStripPlot } from "@/lib/rating-distribution";

const STRIP_LANE_HEIGHT = 22;
const STRIP_BASELINE_OFFSET = 24;

/**
 * Dot/strip plot of current ratings, not a binned histogram - this club has
 * ~10-15 rated players per format, too few for fixed-width bins to be
 * anything but mostly empty or single-count. Each player is a dot on the
 * rating axis; near-identical values stack into their own lane instead of
 * overlapping. Leaders/laggards are direct-labeled by name, matching the
 * "show the top/bottom gap" job this chart is for.
 *
 * A client component so dots can be tapped to reveal their value - a native
 * `title` attribute never fires on touch.
 */
export function RatingDistributionChart({ title, points }: { title: string; points: DistributionPoint[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (points.length < 2) return null;

  const { points: laidOut, min, max } = layoutStripPlot(points);
  const maxLane = Math.max(...laidOut.map((p) => p.lane));
  const padding = Math.max(20, (max - min) * 0.1);
  const domainMin = min - padding;
  const domainMax = max + padding;
  const domain = domainMax - domainMin;
  const lowest = laidOut[0];
  const highest = laidOut[laidOut.length - 1];
  const height = (maxLane + 1) * STRIP_LANE_HEIGHT + STRIP_BASELINE_OFFSET + 8;
  const active = laidOut.find((p) => p.playerId === activeId) ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="relative" style={{ height }}>
        <div
          className="absolute inset-x-0 h-px bg-border"
          style={{ bottom: STRIP_BASELINE_OFFSET }}
        />
        {laidOut.map((p) => {
          const left = `${((p.value - domainMin) / domain) * 100}%`;
          const bottom = STRIP_BASELINE_OFFSET + p.lane * STRIP_LANE_HEIGHT;
          return (
            <button
              key={p.playerId}
              type="button"
              aria-label={`${p.name}: ${p.value}`}
              onClick={() => setActiveId((prev) => (prev === p.playerId ? null : p.playerId))}
              className="absolute size-2.5 -translate-x-1/2 rounded-full bg-primary ring-2 ring-card after:absolute after:inset-[-6px] after:content-['']"
              style={{ left, bottom }}
            />
          );
        })}
        {active && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{
              left: `${((active.value - domainMin) / domain) * 100}%`,
              bottom: STRIP_BASELINE_OFFSET + active.lane * STRIP_LANE_HEIGHT + 10,
            }}
          >
            {active.name}: {active.value}
          </div>
        )}
        <div className="absolute bottom-0 left-0 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{lowest.name}</span> · {lowest.value}
        </div>
        <div className="absolute right-0 bottom-0 text-right text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{highest.name}</span> · {highest.value}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Розрив топ↔низ: <span className="font-medium text-foreground">{max - min}</span> пунктів
      </p>
    </div>
  );
}
