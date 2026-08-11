// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShareResultButton } from "@/components/share-result-button";

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

function mockFetchOk() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["fake-png"], { type: "image/png" })),
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // jsdom doesn't define these by default (no real Web Share API) - tests
  // that opt in via Object.defineProperty must not leak that into later
  // tests, which rely on the unsupported-by-default state.
  // @ts-expect-error - test-only cleanup of a browser API jsdom doesn't define by default
  delete navigator.share;
  // @ts-expect-error - same as above
  delete navigator.canShare;
});

describe("ShareResultButton", () => {
  it("opens a dialog previewing the share-card image", async () => {
    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися результатом матчу"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Поділитися" }));

    expect(screen.getByRole("heading", { name: "Поділитися результатом матчу" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Поділитися результатом матчу" })).toHaveAttribute(
      "src",
      "/api/share/match/m1",
    );
  });

  it("hides the Web Share button when the browser can't share files (jsdom's default)", async () => {
    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));

    expect(screen.queryByRole("button", { name: "Поділитися…" })).not.toBeInTheDocument();
  });

  it("downloads the image as a file and revokes the object URL right after", async () => {
    mockFetchOk();
    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));

    await user.click(screen.getByRole("button", { name: "Завантажити" }));

    expect(global.fetch).toHaveBeenCalledWith("/api/share/match/m1");
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url"));
  });

  it("shows a toast when the download fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    await user.click(screen.getByRole("button", { name: "Завантажити" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Не вдалося завантажити картку"));
  });

  it("shares via the Web Share API when the browser supports sharing files", async () => {
    mockFetchOk();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });

    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися результатом матчу"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));

    const shareButton = await screen.findByRole("button", { name: "Поділитися…" });
    await user.click(shareButton);

    // The dialog `title` is never sent through Web Share - most Android
    // share targets (WhatsApp/Telegram/Messenger) prefill their message from
    // `text`, not `title`, when both a file and text are shared (see
    // ShareResultButton's shareText doc comment).
    await waitFor(() =>
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Іван переміг Петра 6:4, 6:2" }),
      ),
    );
    expect(shareMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.anything() }));
  });

  it("silently ignores the user cancelling the native share sheet", async () => {
    mockFetchOk();
    const abortError = Object.assign(new Error("cancelled"), { name: "AbortError" });
    Object.defineProperty(navigator, "share", { value: vi.fn().mockRejectedValue(abortError), configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });

    const user = userEvent.setup();
    render(
      <ShareResultButton
        imageUrl="/api/share/match/m1"
        fileName="match.png"
        title="Поділитися"
        shareText="Іван переміг Петра 6:4, 6:2"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Поділитися" }));
    const shareButton = await screen.findByRole("button", { name: "Поділитися…" });
    await user.click(shareButton);

    await waitFor(() => expect(shareButton).toBeEnabled());
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
