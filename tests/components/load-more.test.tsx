// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadMore } from "@/components/load-more";

describe("LoadMore", () => {
  it("renders nothing once every item is already shown", () => {
    const { container } = render(<LoadMore shown={10} total={10} href="/players?show=20" label="10 з 10" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to the given href with the running count as its label", () => {
    render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);
    expect(screen.getByText("Показано 10 з 25")).toBeInTheDocument();
    // Rendered as <a> styled like a button (Button's `render` prop exposes role="button" even for a link target).
    expect(screen.getByRole("button", { name: "Завантажити ще" })).toHaveAttribute("href", "/players?show=20");
  });
});
