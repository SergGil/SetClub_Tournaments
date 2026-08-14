// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  HideOnHome,
  HideOnHubPages,
  ShowOnHomeIfAuthorized,
  ShowOnPadelIfAuthorized,
} from "@/components/nav-home-hide";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

describe("HideOnHome", () => {
  it.each(["/", "/admin", "/admin/players", "/admin/padel/tournaments/t1"])(
    "hides children on the generic page %s",
    (pathname) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<HideOnHome>content</HideOnHome>);
      expect(screen.queryByText("content")).not.toBeInTheDocument();
    },
  );

  it.each(["/tennis", "/tournaments", "/coffee", "/padel"])(
    "shows children on a real section page %s",
    (pathname) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<HideOnHome>content</HideOnHome>);
      expect(screen.getByText("content")).toBeInTheDocument();
    },
  );
});

describe("HideOnHubPages", () => {
  it.each(["/", "/admin", "/coffee", "/coffee/menu", "/padel", "/padel/tournaments"])(
    "hides children on hub page %s",
    (pathname) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<HideOnHubPages>content</HideOnHubPages>);
      expect(screen.queryByText("content")).not.toBeInTheDocument();
    },
  );

  it("shows children on a real Tennis section page", () => {
    usePathnameMock.mockReturnValue("/tournaments");
    render(<HideOnHubPages>content</HideOnHubPages>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("ShowOnPadelIfAuthorized", () => {
  it("shows children only when authorized AND on a /padel page", () => {
    usePathnameMock.mockReturnValue("/padel/tournaments");
    const { rerender } = render(<ShowOnPadelIfAuthorized authorized>content</ShowOnPadelIfAuthorized>);
    expect(screen.getByText("content")).toBeInTheDocument();

    rerender(<ShowOnPadelIfAuthorized authorized={false}>content</ShowOnPadelIfAuthorized>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("hides children when authorized but not on a /padel page", () => {
    usePathnameMock.mockReturnValue("/tournaments");
    render(<ShowOnPadelIfAuthorized authorized>content</ShowOnPadelIfAuthorized>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});

describe("ShowOnHomeIfAuthorized", () => {
  it.each(["/", "/admin", "/admin/players"])(
    "shows children when authorized and on the generic page %s",
    (pathname) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<ShowOnHomeIfAuthorized authorized>content</ShowOnHomeIfAuthorized>);
      expect(screen.getByText("content")).toBeInTheDocument();
    },
  );

  it("hides children when not authorized, even on a generic page", () => {
    usePathnameMock.mockReturnValue("/");
    render(<ShowOnHomeIfAuthorized authorized={false}>content</ShowOnHomeIfAuthorized>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("hides children when authorized but not on a generic page", () => {
    usePathnameMock.mockReturnValue("/tournaments");
    render(<ShowOnHomeIfAuthorized authorized>content</ShowOnHomeIfAuthorized>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});
