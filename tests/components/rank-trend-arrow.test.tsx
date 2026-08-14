// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankTrendArrow } from "@/components/rank-trend-arrow";

describe("RankTrendArrow", () => {
  it("renders nothing when delta is undefined (a debut, no previous ranking)", () => {
    const { container } = render(<RankTrendArrow delta={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when delta is 0 (no visible move)", () => {
    const { container } = render(<RankTrendArrow delta={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an up arrow with the magnitude for a positive delta", () => {
    render(<RankTrendArrow delta={3} />);
    expect(screen.getByText("▲3")).toBeInTheDocument();
  });

  it("shows a down arrow with the absolute magnitude for a negative delta", () => {
    render(<RankTrendArrow delta={-2} />);
    expect(screen.getByText("▼2")).toBeInTheDocument();
  });

  it("colors the up and down cases differently", () => {
    const { rerender } = render(<RankTrendArrow delta={1} />);
    expect(screen.getByText("▲1")).toHaveClass("text-emerald-600");

    rerender(<RankTrendArrow delta={-1} />);
    expect(screen.getByText("▼1")).toHaveClass("text-red-600");
  });
});
