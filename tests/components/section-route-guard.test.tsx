// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectionRouteGuard } from "@/components/section-route-guard";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

beforeEach(() => {
  document.documentElement.classList.remove("coffee-route", "padel-route");
});

describe("SectionRouteGuard", () => {
  it("stamps coffee-route on <html> while on /coffee, not padel-route", () => {
    usePathnameMock.mockReturnValue("/coffee/menu");
    render(<SectionRouteGuard />);
    expect(document.documentElement.classList.contains("coffee-route")).toBe(true);
    expect(document.documentElement.classList.contains("padel-route")).toBe(false);
  });

  it("stamps padel-route on <html> while on /padel, not coffee-route", () => {
    usePathnameMock.mockReturnValue("/padel/tournaments");
    render(<SectionRouteGuard />);
    expect(document.documentElement.classList.contains("padel-route")).toBe(true);
    expect(document.documentElement.classList.contains("coffee-route")).toBe(false);
  });

  it("stamps neither class on a Tennis (or generic) route", () => {
    usePathnameMock.mockReturnValue("/tournaments");
    render(<SectionRouteGuard />);
    expect(document.documentElement.classList.contains("coffee-route")).toBe(false);
    expect(document.documentElement.classList.contains("padel-route")).toBe(false);
  });

  it("removes both classes on unmount", () => {
    usePathnameMock.mockReturnValue("/coffee");
    const { unmount } = render(<SectionRouteGuard />);
    expect(document.documentElement.classList.contains("coffee-route")).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains("coffee-route")).toBe(false);
    expect(document.documentElement.classList.contains("padel-route")).toBe(false);
  });

  it("renders nothing itself", () => {
    usePathnameMock.mockReturnValue("/coffee");
    const { container } = render(<SectionRouteGuard />);
    expect(container).toBeEmptyDOMElement();
  });
});
