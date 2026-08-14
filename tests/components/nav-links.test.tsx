// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavLinksDropdownItems, NavLinksInline } from "@/components/nav-links";
import { DropdownMenu, DropdownMenuContent } from "@/components/ui/dropdown-menu";

const { usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock, useSearchParams: useSearchParamsMock }));

const defaultLinks = [
  { href: "/tournaments", label: "Турніри" },
  { href: "/matches", label: "Матчі" },
];
const coffeeLinks = [{ href: "/coffee", label: "Меню" }, { href: "/news?hub=coffee", label: "Новини" }];
const padelLinks = [{ href: "/padel", label: "Падел" }, { href: "/news?hub=padel", label: "Новини" }];

beforeEach(() => {
  useSearchParamsMock.mockReturnValue(new URLSearchParams());
});

describe("NavLinksInline", () => {
  it("marks the link matching the current path active", () => {
    usePathnameMock.mockReturnValue("/matches");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Матчі" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Турніри" })).not.toHaveAttribute("aria-current");
  });

  it("marks a nested route active via prefix match", () => {
    usePathnameMock.mockReturnValue("/tournaments/t1");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Турніри" })).toHaveAttribute("aria-current", "page");
  });

  it("marks nothing active off any known section", () => {
    usePathnameMock.mockReturnValue("/");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.queryByRole("link", { name: /aria-current/ })).not.toBeInTheDocument();
    for (const link of defaultLinks) {
      expect(screen.getByRole("link", { name: link.label })).not.toHaveAttribute("aria-current");
    }
  });

  it("shows the Coffee link set instead of the default set on /coffee", () => {
    usePathnameMock.mockReturnValue("/coffee");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Меню" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("shows the Padel link set instead of the default set on /padel", () => {
    usePathnameMock.mockReturnValue("/padel");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Падел" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("shows nothing on /padel when the caller passes an empty Padel set (unauthorized visitor)", () => {
    usePathnameMock.mockReturnValue("/padel");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={[]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the Coffee link set on /news when it was reached via the ?hub=coffee marker", () => {
    usePathnameMock.mockReturnValue("/news");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("hub=coffee"));
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Меню" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("keeps the Padel link set on /news when it was reached via the ?hub=padel marker", () => {
    usePathnameMock.mockReturnValue("/news");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("hub=padel"));
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Падел" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("falls back to the default set on /news with no hub marker", () => {
    usePathnameMock.mockReturnValue("/news");
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Турніри" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Меню" })).not.toBeInTheDocument();
  });

  it("marks a ?hub=-tagged link active by its own path, ignoring the query string", () => {
    usePathnameMock.mockReturnValue("/news");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("hub=coffee"));
    render(<NavLinksInline defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />);
    expect(screen.getByRole("link", { name: "Новини" })).toHaveAttribute("aria-current", "page");
  });
});

describe("NavLinksDropdownItems", () => {
  it("marks the link matching the current path active", () => {
    usePathnameMock.mockReturnValue("/matches");
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
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
          <NavLinksDropdownItems defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    for (const link of defaultLinks) {
      expect(screen.getByRole("menuitem", { name: link.label })).not.toHaveAttribute("aria-current");
    }
  });

  it("shows the Coffee link set instead of the default set on /coffee", () => {
    usePathnameMock.mockReturnValue("/coffee");
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("menuitem", { name: "Меню" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("shows the Padel link set instead of the default set on /padel", () => {
    usePathnameMock.mockReturnValue("/padel");
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("menuitem", { name: "Падел" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Турніри" })).not.toBeInTheDocument();
  });

  it("keeps the Coffee link set on /news when it was reached via the ?hub=coffee marker", () => {
    usePathnameMock.mockReturnValue("/news");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("hub=coffee"));
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuContent>
          <NavLinksDropdownItems defaultLinks={defaultLinks} coffeeLinks={coffeeLinks} padelLinks={padelLinks} />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("menuitem", { name: "Меню" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Турніри" })).not.toBeInTheDocument();
  });
});
