// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingSparkline } from "@/components/rating-sparkline";

function pts(...ratings: number[]) {
  return ratings.map((rating) => ({ rating }));
}

describe("RatingSparkline", () => {
  it("renders nothing for fewer than two points (no direction to draw)", () => {
    expect(render(<RatingSparkline points={[]} />).container).toBeEmptyDOMElement();
    expect(render(<RatingSparkline points={pts(1500)} />).container).toBeEmptyDOMElement();
  });

  it("shows a signed positive delta in the primary colour for a rising rating", () => {
    const { container, getByText } = render(<RatingSparkline points={pts(1500, 1520, 1550)} />);
    expect(getByText("+50")).toHaveStyle({ color: "var(--primary)" });
    expect(container.querySelector("polyline")).toHaveAttribute("stroke", "var(--primary)");
  });

  it("shows a negative delta (no extra plus) in the destructive colour for a falling rating", () => {
    const { container, getByText } = render(<RatingSparkline points={pts(1600, 1580, 1550)} />);
    expect(getByText("-50")).toHaveStyle({ color: "var(--destructive)" });
    expect(container.querySelector("polyline")).toHaveAttribute("stroke", "var(--destructive)");
  });

  it("shows 0 in the muted colour when the rating ended where it started", () => {
    const { container, getByText } = render(<RatingSparkline points={pts(1500, 1540, 1500)} />);
    expect(getByText("0")).toHaveStyle({ color: "var(--muted-foreground)" });
    expect(container.querySelector("polyline")).toHaveAttribute("stroke", "var(--muted-foreground)");
  });

  it("draws one polyline vertex per point and a dot on the last one", () => {
    const { container } = render(<RatingSparkline points={pts(1500, 1510, 1520, 1530)} />);
    const vertices = container.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(vertices).toHaveLength(4);
    const lastVertex = vertices[3].split(",");
    const dot = container.querySelector("circle")!;
    expect(dot.getAttribute("cx")).toBe(lastVertex[0]);
    expect(dot.getAttribute("cy")).toBe(lastVertex[1]);
  });

  it("puts a higher rating higher on the chart (smaller y) and is hidden from assistive tech", () => {
    const { container } = render(<RatingSparkline points={pts(1500, 1600)} />);
    const [first, second] = container.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(Number(second.split(",")[1])).toBeLessThan(Number(first.split(",")[1]));
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("copes with a perfectly flat series (zero range) without NaN coordinates", () => {
    const { container } = render(<RatingSparkline points={pts(1500, 1500, 1500)} />);
    expect(container.querySelector("polyline")!.getAttribute("points")).not.toMatch(/NaN/);
  });
});
