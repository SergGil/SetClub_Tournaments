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
});
