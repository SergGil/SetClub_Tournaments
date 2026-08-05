// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchInput } from "@/components/search-input";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/players",
  useSearchParams: () => new URLSearchParams("sort=name"),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SearchInput", () => {
  it("does not navigate on mount when the value matches the current query", async () => {
    render(<SearchInput placeholder="Пошук гравця" defaultValue="Іван" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("debounces navigation, preserving other query params, and setting q", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchInput placeholder="Пошук гравця" />);
    await user.type(screen.getByRole("searchbox", { name: "Пошук гравця" }), "Іван");

    expect(replaceMock).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(replaceMock).toHaveBeenCalledWith(
      `/players?sort=name&q=${encodeURIComponent("Іван")}`,
      { scroll: false },
    );
  });

  it("drops the q param entirely once cleared", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchInput placeholder="Пошук гравця" defaultValue="Іван" />);
    await user.clear(screen.getByRole("searchbox", { name: "Пошук гравця" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(replaceMock).toHaveBeenCalledWith("/players?sort=name", { scroll: false });
  });
});
