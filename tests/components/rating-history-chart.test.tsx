// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RatingHistoryChart } from "@/components/rating-history-chart";

const points = [
  { tournamentId: "t1", asOfDate: "2026-01-01T00:00:00.000Z", rating: 1500, spread: 100 },
  { tournamentId: "t2", asOfDate: "2026-02-01T00:00:00.000Z", rating: 1550, spread: 90 },
  { tournamentId: "t3", asOfDate: "2026-03-01T00:00:00.000Z", rating: 1600, spread: 80 },
];

describe("RatingHistoryChart", () => {
  it("defaults the summary line to the most recent point", () => {
    render(<RatingHistoryChart points={points} />);
    expect(screen.getByText("01.03.26: 1600 ±80")).toBeInTheDocument();
  });

  it("shows the earliest and latest dates as UTC, not the local timezone", () => {
    render(<RatingHistoryChart points={points} />);
    expect(screen.getByText("01.01.26")).toBeInTheDocument();
    expect(screen.getByText("01.03.26")).toBeInTheDocument();
  });

  it("switches the summary to whichever point is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<RatingHistoryChart points={points} />);
    const hitCircles = container.querySelectorAll("circle[fill='transparent']");
    expect(hitCircles).toHaveLength(3);

    await user.click(hitCircles[0]);
    expect(screen.getByText("01.01.26: 1500 ±100")).toBeInTheDocument();
  });
});
