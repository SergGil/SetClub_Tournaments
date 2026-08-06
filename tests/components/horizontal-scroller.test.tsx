// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HorizontalScroller } from "@/components/horizontal-scroller";

beforeEach(() => {
  // jsdom doesn't implement scrollBy - the component calls it on arrow clicks.
  Element.prototype.scrollBy = vi.fn();
});

function Items() {
  return (
    <>
      <span>Item 1</span>
      <span>Item 2</span>
    </>
  );
}

describe("HorizontalScroller", () => {
  it("renders its children", () => {
    render(
      <HorizontalScroller>
        <Items />
      </HorizontalScroller>,
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("starts with the left arrow disabled and the right arrow enabled", () => {
    render(
      <HorizontalScroller>
        <Items />
      </HorizontalScroller>,
    );
    expect(screen.getByRole("button", { name: "Прокрутити ліворуч" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Прокрутити праворуч" })).toBeEnabled();
  });

  it("re-evaluates the edge buttons as the strip scrolls", () => {
    render(
      <HorizontalScroller>
        <Items />
      </HorizontalScroller>,
    );
    const scroller = screen.getByText("Item 1").parentElement!;

    Object.defineProperty(scroller, "scrollLeft", { value: 60, configurable: true });
    Object.defineProperty(scroller, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(scroller, "scrollWidth", { value: 260, configurable: true });
    fireEvent.scroll(scroller);

    expect(screen.getByRole("button", { name: "Прокрутити ліворуч" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Прокрутити праворуч" })).toBeDisabled();
  });

  it("scrolls by the default step when an arrow is clicked", () => {
    render(
      <HorizontalScroller>
        <Items />
      </HorizontalScroller>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Прокрутити праворуч" }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledWith({ left: 280, behavior: "smooth" });
  });

  it("scrolls by a custom step when scrollStepPx is given", () => {
    render(
      <HorizontalScroller scrollStepPx={100}>
        <Items />
      </HorizontalScroller>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Прокрутити праворуч" }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledWith({ left: 100, behavior: "smooth" });
  });
});
