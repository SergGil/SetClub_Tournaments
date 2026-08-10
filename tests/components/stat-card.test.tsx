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

  it("renders as a plain (non-link) tile with no href", () => {
    render(<StatCard label="Матчів зіграно" value={42} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders as a link to the given href, marking it current when active", () => {
    render(<StatCard label="Перемог" value={10} href="/players/p1?result=win" active />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/players/p1?result=win");
    expect(link).toHaveAttribute("aria-current", "true");
  });

  it("doesn't mark the link current when not active", () => {
    render(<StatCard label="Поразок" value={3} href="/players/p1?result=loss" />);
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });
});
