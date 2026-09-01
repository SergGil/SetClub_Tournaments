import { describe, expect, it } from "vitest";

import { layoutStripPlot } from "@/lib/rating-distribution";

describe("layoutStripPlot", () => {
  it("returns an empty layout for no points", () => {
    expect(layoutStripPlot([])).toEqual({ points: [], min: 0, max: 0 });
  });

  it("reports the min and max value", () => {
    const { min, max } = layoutStripPlot([
      { playerId: "a", name: "A", value: 1000 },
      { playerId: "b", name: "B", value: 1400 },
      { playerId: "c", name: "C", value: 1200 },
    ]);
    expect(min).toBe(1000);
    expect(max).toBe(1400);
  });

  it("keeps well-separated points on lane 0", () => {
    const { points } = layoutStripPlot([
      { playerId: "a", name: "A", value: 1000 },
      { playerId: "b", name: "B", value: 1400 },
    ]);
    expect(points.every((p) => p.lane === 0)).toBe(true);
  });

  it("stacks values that sit close together relative to the overall spread", () => {
    // Domain is 1000-1400 (400 wide); 1000/1005/1010 all land within the
    // first ~2.5% of that range, well under the collision threshold.
    const { points } = layoutStripPlot([
      { playerId: "a", name: "A", value: 1000 },
      { playerId: "b", name: "B", value: 1005 },
      { playerId: "c", name: "C", value: 1010 },
      { playerId: "d", name: "D", value: 1400 },
    ]);
    const lanes = points.map((p) => p.lane);
    expect(lanes).toEqual([0, 1, 2, 0]);
  });

  it("resets the lane once the gap widens again", () => {
    const { points } = layoutStripPlot([
      { playerId: "a", name: "A", value: 1000 },
      { playerId: "b", name: "B", value: 1005 },
      { playerId: "c", name: "C", value: 1400 },
    ]);
    expect(points.find((p) => p.playerId === "c")!.lane).toBe(0);
  });

  it("keeps lane depth bounded by local density even across a long dense run", () => {
    // 30 players 1 point apart on a 0-1000 domain - each only collides with
    // its ~6 nearest neighbors (COLLISION_GAP_PCT of that domain), so no
    // point should ever need more than a handful of lanes, regardless of how
    // long the overall run is. The old (buggy) implementation climbed one
    // new lane per point in the run, reaching lane 29 here.
    const points = Array.from({ length: 30 }, (_, i) => ({
      playerId: `p${i}`,
      name: `P${i}`,
      value: i,
    }));
    const { points: laidOut } = layoutStripPlot(points);
    const maxLane = Math.max(...laidOut.map((p) => p.lane));
    expect(maxLane).toBeLessThan(10);
  });
});
