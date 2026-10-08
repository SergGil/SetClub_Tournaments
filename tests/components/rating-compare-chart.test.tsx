// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingCompareChart } from "@/components/rating-compare-chart";

const a = [
  { asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500 },
  { asOfDate: "2026-04-01T00:00:00.000Z", rating: 1600 },
];
const b = [
  { asOfDate: "2026-02-01T00:00:00.000Z", rating: 1400 },
  { asOfDate: "2026-03-01T00:00:00.000Z", rating: 1450 },
];

describe("RatingCompareChart", () => {
  it("renders nothing when there are fewer than two points in total", () => {
    expect(render(<RatingCompareChart seriesA={[]} seriesB={[]} />).container).toBeEmptyDOMElement();
    expect(
      render(<RatingCompareChart seriesA={[a[0]]} seriesB={[]} />).container,
    ).toBeEmptyDOMElement();
  });

  it("draws one line per series (the second dashed) with a dot on each series' last point", () => {
    const { container } = render(<RatingCompareChart seriesA={a} seriesB={b} />);
    const lines = container.querySelectorAll("polyline");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toHaveAttribute("stroke-dasharray");
    expect(lines[1]).toHaveAttribute("stroke-dasharray", "5 3");
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("uses the given colours, defaulting to the theme tokens", () => {
    const defaults = render(<RatingCompareChart seriesA={a} seriesB={b} />).container.querySelectorAll("polyline");
    expect(defaults[0]).toHaveAttribute("stroke", "var(--primary)");
    expect(defaults[1]).toHaveAttribute("stroke", "var(--compare-secondary)");

    const custom = render(<RatingCompareChart seriesA={a} seriesB={b} colorA="red" colorB="blue" />).container.querySelectorAll(
      "polyline",
    );
    expect(custom[0]).toHaveAttribute("stroke", "red");
    expect(custom[1]).toHaveAttribute("stroke", "blue");
  });

  it("skips a series that has fewer than two points but still plots the other", () => {
    const { container } = render(<RatingCompareChart seriesA={a} seriesB={[b[0]]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("labels four evenly spaced dates over the COMBINED range, as UTC dd.mm.yy", () => {
    render(<RatingCompareChart seriesA={a} seriesB={b} />);
    expect(screen.getByText("01.01.26")).toBeInTheDocument();
    expect(screen.getByText("01.04.26")).toBeInTheDocument();
    // two evenly spaced midpoints between 1 Jan and 1 Apr (90 days -> +30d, +60d)
    expect(screen.getByText("31.01.26")).toBeInTheDocument();
    expect(screen.getByText("02.03.26")).toBeInTheDocument();
  });

  it("puts a higher rating higher on the chart (smaller y) across both series", () => {
    const { container } = render(<RatingCompareChart seriesA={a} seriesB={b} />);
    const [lineA, lineB] = Array.from(container.querySelectorAll("polyline")).map((l) =>
      l
        .getAttribute("points")!
        .split(" ")
        .map((p) => Number(p.split(",")[1])),
    );
    expect(lineA[1]).toBeLessThan(lineA[0]); // 1500 -> 1600 rises
    expect(Math.min(...lineA)).toBeLessThan(Math.min(...lineB)); // A's peak is above B's best
  });

  it("does not produce NaN when every point shares one date and rating", () => {
    const flat = [
      { asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500 },
      { asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500 },
    ];
    const { container } = render(<RatingCompareChart seriesA={flat} seriesB={[]} />);
    expect(container.innerHTML).not.toMatch(/NaN/);
  });
});
