// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "@/components/logo";

describe("Logo", () => {
  it("defaults to a 32px square with an accessible name", () => {
    render(<Logo />);
    const svg = screen.getByRole("img", { name: "Set Club" });
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("honors a custom size", () => {
    render(<Logo size={48} />);
    const svg = screen.getByRole("img", { name: "Set Club" });
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });
});
