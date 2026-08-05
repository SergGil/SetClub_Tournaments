// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RatingDistributionChart } from "@/components/rating-distribution-chart";

describe("RatingDistributionChart", () => {
  it("renders nothing with fewer than 2 rated players", () => {
    const { container } = render(
      <RatingDistributionChart title="Одиночний" points={[{ playerId: "p1", name: "Іван", value: 1500 }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the lowest and highest points and reports the gap between them", () => {
    render(
      <RatingDistributionChart
        title="Одиночний"
        points={[
          { playerId: "p1", name: "Іван", value: 1400 },
          { playerId: "p2", name: "Петро", value: 1600 },
        ]}
      />,
    );
    expect(screen.getByText("Іван")).toBeInTheDocument();
    expect(screen.getByText("Петро")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument(); // 1600 - 1400
  });

  it("toggles a point's value tooltip on click", async () => {
    const user = userEvent.setup();
    render(
      <RatingDistributionChart
        title="Одиночний"
        points={[
          { playerId: "p1", name: "Іван", value: 1400 },
          { playerId: "p2", name: "Петро", value: 1600 },
        ]}
      />,
    );
    const dot = screen.getByRole("button", { name: "Іван: 1400" });
    expect(screen.queryByText("Іван: 1400", { selector: "div" })).not.toBeInTheDocument();

    await user.click(dot);
    expect(screen.getByText("Іван: 1400", { selector: "div" })).toBeInTheDocument();

    await user.click(dot);
    expect(screen.queryByText("Іван: 1400", { selector: "div" })).not.toBeInTheDocument();
  });
});
