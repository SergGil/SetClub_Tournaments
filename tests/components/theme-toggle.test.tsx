// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("starts unchecked when <html> has no dark class", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("switch", { name: "Темна тема" })).not.toBeChecked();
  });

  it("reflects an already-applied dark class (set by the anti-flash script)", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("switch", { name: "Темна тема" })).toBeChecked();
  });

  it("toggles the html class and persists the choice to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("switch", { name: "Темна тема" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("setclub:theme")).toBe("dark");
    expect(screen.getByRole("switch", { name: "Темна тема" })).toBeChecked();
  });
});
