// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavLinksDropdownItems, NavLinksInline } from "@/components/nav-links";
import { DropdownMenu, DropdownMenuContent } from "@/components/ui/dropdown-menu";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

const links = [
  { href: "/tournaments", label: "Турніри" },
  { href: "/matches", label: "Матчі" },
];

describe("NavLinksInline", () => {
  it("marks the link matching the current path active", () => {
    usePathnameMock.mockReturnValue("/matches");
    render(<NavLinksInline links={links} />);
    expect(screen.getByRole("link", { name: "Матчі" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Турніри" })).not.toHaveAttribute("aria-current");
  });

  it("marks a nested route active via prefix match", () => {
    usePathnameMock.mockReturnValue("/tournaments/t1");
    render(<NavLinksInline links={links} />);
    expect(screen.getByRole("link", { name: "Турніри" })).toHaveAttribute("aria-current", "page");
  });

  it("marks nothing active off any known section", () => {
    usePathnameMock.mockReturnValue("/");
    render(<NavLinksInline links={links} />);
    expect(screen.queryByRole("link", { name: /aria-current/ })).not.toBeInTheDocument();
    for (const link of links) {
      expect(screen.getByRole("link", { name: link.label })).not.toHaveAttribute("aria-current");
    }
  });
});

describe("NavLinksDropdownItems", () => {
  it("marks the link matching the current path active", () => {
    usePathnameMock.mockReturnValue("/matches");
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems links={links} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("menuitem", { name: "Матчі" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: "Турніри" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing active off any known section", () => {
    usePathnameMock.mockReturnValue("/");
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems links={links} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    for (const link of links) {
      expect(screen.getByRole("menuitem", { name: link.label })).not.toHaveAttribute("aria-current");
    }
  });
});
