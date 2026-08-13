// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/admin/admin-nav";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: usePathnameMock }));

describe("AdminNav", () => {
  it("marks only the exact /admin overview link active on the overview page itself", () => {
    usePathnameMock.mockReturnValue("/admin");
    render(<AdminNav isSuperAdmin domains={[]} />);
    expect(screen.getByRole("link", { name: "Огляд" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Гравці" })).not.toHaveAttribute("aria-current");
  });

  it("does not treat every admin route as matching the overview link", () => {
    // "/admin/players" starts with "/admin" too - a naive startsWith check on
    // the overview link alone would wrongly mark it active on every subpage.
    usePathnameMock.mockReturnValue("/admin/players");
    render(<AdminNav isSuperAdmin domains={[]} />);
    expect(screen.getByRole("link", { name: "Огляд" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Гравці" })).toHaveAttribute("aria-current", "page");
  });

  it("marks a nested route active on its section link via prefix match", () => {
    usePathnameMock.mockReturnValue("/admin/tournaments/t1");
    render(<AdminNav isSuperAdmin domains={[]} />);
    expect(screen.getByRole("link", { name: "Турніри" })).toHaveAttribute("aria-current", "page");
  });

  it("shows every link to a superadmin regardless of domains", () => {
    usePathnameMock.mockReturnValue("/admin");
    render(<AdminNav isSuperAdmin domains={[]} />);
    for (const label of ["Огляд", "Гравці", "Турніри", "Новини", "Користувачі", "Журнал"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows a TENNIS-domain admin the tennis sections but not the superadmin-only ones", () => {
    usePathnameMock.mockReturnValue("/admin");
    render(<AdminNav isSuperAdmin={false} domains={["TENNIS"]} />);
    for (const label of ["Огляд", "Гравці", "Турніри", "Новини"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Користувачі" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Журнал" })).not.toBeInTheDocument();
  });

  it("hides tennis sections from a COFFEE-only admin, but still shows the shared News link", () => {
    usePathnameMock.mockReturnValue("/admin");
    render(<AdminNav isSuperAdmin={false} domains={["COFFEE"]} />);
    expect(screen.getByRole("link", { name: "Огляд" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Гравці" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Турніри" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Новини" })).toBeInTheDocument();
  });
});
