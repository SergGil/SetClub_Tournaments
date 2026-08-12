// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// jsdom defines `window`, which tricks the real "server-only" package (it
// detects client bundles via `typeof window`) into throwing - Nav is a real
// Server Component in production, this guard is only a test-environment
// artifact. Same fix as tests/lib/permissions.test.ts, needed here too now
// that Nav imports getAdminScope from @/lib/permissions.
vi.mock("server-only", () => ({}));

import { Nav } from "@/components/nav";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

const { getPlayerByUserIdMock } = vi.hoisted(() => ({ getPlayerByUserIdMock: vi.fn() }));
vi.mock("@/lib/queries/players", () => ({ getPlayerByUserId: getPlayerByUserIdMock }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <div>stub-theme-toggle</div> }));
vi.mock("@/components/background-toggle", () => ({ BackgroundToggle: () => <div>stub-bg-toggle</div> }));
vi.mock("@/components/auth-buttons", () => ({ SignInButton: () => <button>Увійти</button> }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => <button>Вийти</button> }));

async function renderNav() {
  render(await Nav());
}

describe("Nav (anonymous)", () => {
  it("shows a sign-in button and no identity", async () => {
    authMock.mockResolvedValueOnce(null);
    await renderNav();
    expect(screen.getByRole("button", { name: "Увійти" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вийти" })).not.toBeInTheDocument();
    expect(getPlayerByUserIdMock).not.toHaveBeenCalled();
  });

  it("does not offer the admin panel link", async () => {
    authMock.mockResolvedValueOnce(null);
    await renderNav();
    expect(screen.queryByRole("link", { name: "Адмін-панель" })).not.toBeInTheDocument();
  });
});

describe("Nav (signed in, member)", () => {
  it("shows the display name and sign-out control, without the admin badge", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "MEMBER", name: "Іван Петренко", email: "ivan@test.com", image: null },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce(null);
    await renderNav();

    expect(screen.getByText("Іван Петренко")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Вийти" })).toBeInTheDocument();
    expect(screen.queryByText("Адмін")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Адмін-панель" })).not.toBeInTheDocument();
  });

  it("does not link the identity to a player page when no player is linked", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "MEMBER", name: "Іван", email: "ivan@test.com", image: null },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce(null);
    await renderNav();
    expect(screen.queryByRole("link", { name: /Іван/ })).not.toBeInTheDocument();
  });

  it("links the identity to the linked player's page, preferring the player's own name", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "MEMBER", name: "Auth Name", email: "ivan@test.com", image: null },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce({ id: "p1", name: "Player Name" });
    await renderNav();

    expect(screen.getByText("Player Name")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Player Name/ })).toHaveAttribute("href", "/players/p1");
  });
});

describe("Nav (signed in, superadmin)", () => {
  it("adds the admin panel link and the superadmin badge", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "SUPERADMIN", name: "Admin", email: "admin@test.com", image: null, domains: [] },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce(null);
    await renderNav();

    expect(screen.getByRole("link", { name: "Адмін-панель" })).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Суперадмін")).toBeInTheDocument();
  });
});

describe("Nav (signed in, scoped domain admin)", () => {
  it("adds the admin panel link and the (non-super) admin badge once a domain is granted", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", name: "Admin", email: "admin@test.com", image: null, domains: ["TENNIS"] },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce(null);
    await renderNav();

    expect(screen.getByRole("link", { name: "Адмін-панель" })).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Адмін")).toBeInTheDocument();
    expect(screen.queryByText("Суперадмін")).not.toBeInTheDocument();
  });

  it("does not offer the admin panel link for an ADMIN with no domains granted yet", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", name: "Admin", email: "admin@test.com", image: null, domains: [] },
    });
    getPlayerByUserIdMock.mockResolvedValueOnce(null);
    await renderNav();

    expect(screen.queryByRole("link", { name: "Адмін-панель" })).not.toBeInTheDocument();
    expect(screen.queryByText("Адмін")).not.toBeInTheDocument();
  });
});
