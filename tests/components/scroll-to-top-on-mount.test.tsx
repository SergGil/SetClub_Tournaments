// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ScrollToTopOnMount } from "@/components/scroll-to-top-on-mount";

const scrollToMock = vi.fn();

beforeEach(() => {
  scrollToMock.mockClear();
  window.scrollTo = scrollToMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("scrolls to the top on mount", () => {
  render(<ScrollToTopOnMount resetKey="t1" />);

  expect(scrollToMock).toHaveBeenCalledWith(0, 0);
});

it("scrolls to the top again when resetKey changes (navigating to a different instance of the route)", () => {
  const { rerender } = render(<ScrollToTopOnMount resetKey="t1" />);
  scrollToMock.mockClear();

  rerender(<ScrollToTopOnMount resetKey="t2" />);

  expect(scrollToMock).toHaveBeenCalledTimes(1);
  expect(scrollToMock).toHaveBeenCalledWith(0, 0);
});

it("does not scroll again on a re-render with the same resetKey", () => {
  const { rerender } = render(<ScrollToTopOnMount resetKey="t1" />);
  scrollToMock.mockClear();

  rerender(<ScrollToTopOnMount resetKey="t1" />);

  expect(scrollToMock).not.toHaveBeenCalled();
});

it("renders nothing", () => {
  const { container } = render(<ScrollToTopOnMount resetKey="t1" />);

  expect(container).toBeEmptyDOMElement();
});
