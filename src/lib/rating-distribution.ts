export type DistributionPoint = { playerId: string; name: string; value: number };
export type LaidOutPoint = DistributionPoint & { lane: number };

/** Percent of the value range below which two points are considered "colliding" and get stacked into separate lanes instead of overlapping. */
const COLLISION_GAP_PCT = 6;

/**
 * Lays out points along a single axis (sorted ascending), stacking points
 * that would otherwise overlap into incremental lanes - a simple greedy
 * beeswarm, good enough for the small player counts this club has (a rigid
 * fixed-width histogram bin would mostly be empty or single-count at this N).
 */
export function layoutStripPlot(points: DistributionPoint[]): {
  points: LaidOutPoint[];
  min: number;
  max: number;
} {
  if (points.length === 0) return { points: [], min: 0, max: 0 };

  const sorted = [...points].sort((a, b) => a.value - b.value);
  const min = sorted[0].value;
  const max = sorted[sorted.length - 1].value;
  const domain = Math.max(1, max - min);

  const laidOut: LaidOutPoint[] = [];
  // Last pct placed in each lane - a point goes into the lowest lane whose
  // current occupant it doesn't collide with, so a long dense run only grows
  // as many lanes deep as it is simultaneously wide. (Comparing only to the
  // immediately preceding point, as this used to, made the lane climb by one
  // for every point in a long run - even points far apart got pushed to
  // ever-higher lanes - which is what blew up the doubles chart's height at
  // ~30+ players.)
  const lastPctByLane: number[] = [];
  for (const point of sorted) {
    const pct = ((point.value - min) / domain) * 100;
    let lane = 0;
    while (lane < lastPctByLane.length && pct - lastPctByLane[lane] < COLLISION_GAP_PCT) {
      lane++;
    }
    lastPctByLane[lane] = pct;
    laidOut.push({ ...point, lane });
  }

  return { points: laidOut, min, max };
}
