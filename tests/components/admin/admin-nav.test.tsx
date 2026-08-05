// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/admin/admin-nav";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

describe("AdminNav", () => {
  it("marks only the exact /admin overview link active on the overview page itself", () => {
    usePathnameMock.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "Огляд" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Гравці" })).not.toHaveAttribute("aria-current");
  });

  it("does not treat every admin route as matching the overview link", () => {
    // "/admin/players" starts with "/admin" too - a naive startsWith check on
    // the overview link alone would wrongly mark it active on every subpage.
    usePathnameMock.mockReturnValue("/admin/players");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "Огляд" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Гравці" })).toHaveAttribute("aria-current", "page");
  });

  it("marks a nested route active on its section link via prefix match", () => {
    usePathnameMock.mockReturnValue("/admin/tournaments/t1");
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "Турніри" })).toHaveAttribute("aria-current", "page");
  });
});
