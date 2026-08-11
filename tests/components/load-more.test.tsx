// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoadMore } from "@/components/load-more";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

let ioCallback: IntersectionObserverCallback | null = null;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  ioCallback = null;
  // jsdom has no IntersectionObserver at all - stub a minimal fake that
  // captures the callback so tests can simulate the sentinel scrolling
  // into view via intersect() below.
  // @ts-expect-error - test-only global stub, not the real browser API shape
  global.IntersectionObserver = vi.fn(function FakeIntersectionObserver(callback: IntersectionObserverCallback) {
    ioCallback = callback;
    return { observe: observeMock, disconnect: disconnectMock, unobserve: vi.fn() };
  });
});

function intersect() {
  ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
}

describe("LoadMore", () => {
  it("renders nothing once every item is already shown", () => {
    const { container } = render(<LoadMore shown={10} total={10} href="/players?show=20" label="10 з 10" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not observe anything once everything is already shown - no sentinel to watch", () => {
    render(<LoadMore shown={10} total={10} href="/players?show=20" label="10 з 10" />);
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("links to the given href with the running count as its label", () => {
    render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);
    expect(screen.getByText("Показано 10 з 25")).toBeInTheDocument();
    // Rendered as <a> styled like a button (Button's `render` prop exposes role="button" even for a link target).
    expect(screen.getByRole("button", { name: "Завантажити ще" })).toHaveAttribute("href", "/players?show=20");
  });

  it("navigates to the same href as the button once the sentinel scrolls into view", () => {
    render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);

    intersect();

    expect(pushMock).toHaveBeenCalledWith("/players?show=20", { scroll: false });
  });

  it("does not navigate twice for the same href while it's still in view", () => {
    render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);

    intersect();
    intersect();

    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("navigates again once the next page loads and the sentinel is still in view", () => {
    const { rerender } = render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);
    intersect();

    rerender(<LoadMore shown={20} total={25} href="/players?show=30" label="Показано 20 з 25" />);
    intersect();

    expect(pushMock).toHaveBeenNthCalledWith(1, "/players?show=20", { scroll: false });
    expect(pushMock).toHaveBeenNthCalledWith(2, "/players?show=30", { scroll: false });
  });

  it("stops triggering once the next page shows everything", () => {
    const { rerender } = render(<LoadMore shown={10} total={25} href="/players?show=20" label="Показано 10 з 25" />);
    intersect();

    rerender(<LoadMore shown={25} total={25} href="/players?show=30" label="25 з 25" />);
    intersect();

    expect(pushMock).toHaveBeenCalledTimes(1);
  });
});
