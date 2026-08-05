// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PullToRefresh } from "@/components/pull-to-refresh";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function mockEnvironment({ standalone, iOS }: { standalone: boolean; iOS: boolean }) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: standalone }));
  Object.defineProperty(window.navigator, "userAgent", {
    value: iOS ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" : "Mozilla/5.0 (Windows NT 10.0)",
    configurable: true,
  });
}

function touch(type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent & {
    touches: { clientY: number }[];
  };
  Object.defineProperty(event, "touches", { value: [{ clientY }] });
  // The listeners are attached via a plain document.addEventListener (not
  // React's synthetic event system), so the state updates they trigger need
  // an explicit act() to flush synchronously before the next assertion.
  act(() => {
    document.dispatchEvent(event);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PullToRefresh (not an iOS standalone app)", () => {
  it("renders nothing and never attaches gesture handling", () => {
    mockEnvironment({ standalone: false, iOS: false });
    const { container } = render(<PullToRefresh />);
    touch("touchstart", 0);
    touch("touchmove", 150);
    touch("touchend", 150);
    expect(container).toBeEmptyDOMElement();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("PullToRefresh (iOS standalone app)", () => {
  it("refreshes once pulled past the threshold", async () => {
    mockEnvironment({ standalone: true, iOS: true });
    const { container } = render(<PullToRefresh />);

    touch("touchstart", 0);
    touch("touchmove", 150); // past PULL_THRESHOLD (70)
    touch("touchend", 150);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(container.firstChild).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("does not refresh when released before the threshold", () => {
    mockEnvironment({ standalone: true, iOS: true });
    const { container } = render(<PullToRefresh />);

    touch("touchstart", 0);
    touch("touchmove", 40); // under PULL_THRESHOLD (70)
    touch("touchend", 40);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores an upward drag entirely", () => {
    mockEnvironment({ standalone: true, iOS: true });
    const { container } = render(<PullToRefresh />);

    touch("touchstart", 100);
    touch("touchmove", 50); // moved up, not down
    expect(container).toBeEmptyDOMElement();
  });
});
