// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "@/components/stat-card";

describe("StatCard", () => {
  it("renders the label and value with no tone by default", () => {
    render(<StatCard label="Матчів зіграно" value={42} />);
    const value = screen.getByText("42");
    expect(screen.getByText("Матчів зіграно")).toBeInTheDocument();
    expect(value.className).not.toMatch(/text-primary|text-destructive/);
  });

  it("colors the value positively or negatively per the given tone", () => {
    const { rerender } = render(<StatCard label="Перемог" value={10} tone="positive" />);
    expect(screen.getByText("10").className).toContain("text-primary");

    rerender(<StatCard label="Поразок" value={3} tone="negative" />);
    expect(screen.getByText("3").className).toContain("text-destructive");
  });
});
