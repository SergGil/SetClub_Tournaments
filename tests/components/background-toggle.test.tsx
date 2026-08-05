// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { BackgroundToggle } from "@/components/background-toggle";

beforeEach(() => {
  document.documentElement.classList.remove("bg-photo");
  localStorage.clear();
});

describe("BackgroundToggle", () => {
  it("starts unchecked when <html> has no bg-photo class", () => {
    render(<BackgroundToggle />);
    expect(screen.getByRole("switch", { name: "Фото корту як фон сайту" })).not.toBeChecked();
  });

  it("toggles the html class and persists the choice to localStorage", async () => {
    const user = userEvent.setup();
    render(<BackgroundToggle />);
    await user.click(screen.getByRole("switch", { name: "Фото корту як фон сайту" }));

    expect(document.documentElement.classList.contains("bg-photo")).toBe(true);
    expect(localStorage.getItem("setclub:bg-photo")).toBe("1");
  });

  it("clears the class and stores '0' when toggled back off", async () => {
    document.documentElement.classList.add("bg-photo");
    const user = userEvent.setup();
    render(<BackgroundToggle />);
    await user.click(screen.getByRole("switch", { name: "Фото корту як фон сайту" }));

    expect(document.documentElement.classList.contains("bg-photo")).toBe(false);
    expect(localStorage.getItem("setclub:bg-photo")).toBe("0");
  });
});
