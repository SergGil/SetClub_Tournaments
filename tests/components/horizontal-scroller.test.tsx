// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HorizontalScroller } from "@/components/horizontal-scroller";

beforeEach(() => {
  // jsdom doesn't implement scrollBy - the component calls it on arrow clicks.
  Element.prototype.scrollBy = vi.fn();
  // jsdom never actually lays out content, so clientWidth/scrollWidth are
  // always 0 by default - which the component would (correctly) read as "no
  // overflow, nothing to scroll to". Default every element to an overflowing
  // layout here so the existing-content tests below exercise the same
  // "there's more to the right" state a real, wider-than-its-container strip
  // would have; the "doesn't overflow" test overrides this per-instance.
  Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, value: 200 });
  Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, value: 260 });
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

  it("disables the right arrow on mount when content doesn't actually overflow", () => {
    // Override the "always overflowing" default from beforeEach - content
    // that exactly fills its container, nothing to scroll to. No scroll
    // event fires here on purpose: that's the bug this test guards against
    // (src/components/horizontal-scroller.tsx) - with nothing to scroll to
    // and nothing ever scrolled, onScroll never fires, so the only way to
    // know is measuring on mount rather than waiting for an event that will
    // never come.
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, value: 200 });
    render(
      <HorizontalScroller>
        <Items />
      </HorizontalScroller>,
    );

    expect(screen.getByRole("button", { name: "Прокрутити праворуч" })).toBeDisabled();
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
