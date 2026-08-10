// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoLightbox } from "@/components/photo-lightbox";
import type { deletePhotoAction } from "@/lib/actions/photos";

const { deletePhotoActionMock } = vi.hoisted(() => ({
  deletePhotoActionMock: vi.fn<typeof deletePhotoAction>(),
}));
vi.mock("@/lib/actions/photos", () => ({ deletePhotoAction: deletePhotoActionMock }));

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }));

const photos = [
  { id: "p1", url: "https://pub-test.r2.dev/p1.jpg", caption: "Фінал" },
  { id: "p2", url: "https://pub-test.r2.dev/p2.jpg", caption: "Півфінал" },
  { id: "p3", url: "https://pub-test.r2.dev/p3.jpg", caption: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PhotoLightbox (grid)", () => {
  it("renders one thumbnail button per photo", () => {
    render(<PhotoLightbox photos={photos} canManage={false} />);
    expect(screen.getByRole("button", { name: "Фінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Півфінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Фото турніру" })).toBeInTheDocument();
  });
});

describe("PhotoLightbox (lightbox navigation)", () => {
  it("opens the clicked photo and disables prev/next at the ends", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Попереднє фото" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Наступне фото" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Наступне фото" }));
    expect(screen.getByRole("img", { name: "Півфінал" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Наступне фото" }));
    expect(screen.getByRole("img", { name: "Фото турніру" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Наступне фото" })).toBeDisabled();
  });

  it("navigates with ArrowLeft/ArrowRight, clamped at both ends", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();

    // Dispatched directly on `document` (not via user.keyboard, which
    // targets document.activeElement) - the listener is document-level by
    // design (see photo-lightbox.tsx), precisely so it doesn't depend on
    // which element inside the dialog currently has focus.
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "Півфінал" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "Фото турніру" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "Фото турніру" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "Півфінал" })).toBeInTheDocument();
  });

  it("stops listening for arrow keys once the lightbox is closed", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Закрити" }));

    // No dialog open - an ArrowRight now must not throw, reopen the dialog,
    // or otherwise do anything. "Закрити" only exists while the lightbox is
    // open (the grid thumbnails themselves stay in the DOM either way).
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.queryByRole("button", { name: "Закрити" })).not.toBeInTheDocument();
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Закрити" }));
    // The grid thumbnail (next/image, alt="Фінал") stays in the DOM behind
    // the dialog - only dialog-only controls disappear once it closes.
    expect(screen.queryByRole("button", { name: "Закрити" })).not.toBeInTheDocument();
  });
});

describe("PhotoLightbox (delete gating)", () => {
  it("hides the delete button for non-admins", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.queryByRole("button", { name: "Видалити фото" })).not.toBeInTheDocument();
  });

  it("shows the delete button for admins", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.getByRole("button", { name: "Видалити фото" })).toBeInTheDocument();
  });
});

describe("PhotoLightbox (delete flow)", () => {
  it("asks for confirmation instead of deleting immediately", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));

    expect(screen.getByRole("heading", { name: "Видалити фото?" })).toBeInTheDocument();
    expect(deletePhotoActionMock).not.toHaveBeenCalled();
  });

  it("does nothing if the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(deletePhotoActionMock).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();
  });

  it("deletes the active photo, toasts success, and closes the lightbox", async () => {
    deletePhotoActionMock.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    expect(deletePhotoActionMock).toHaveBeenCalledWith("p1");
    expect(toastSuccessMock).toHaveBeenCalledWith("Фото видалено");
    // Removing the deleted photo from the grid is the parent's job (revalidatePath
    // + re-render with fresh data) - this component only closes the dialog on success.
    expect(screen.queryByRole("button", { name: "Закрити" })).not.toBeInTheDocument();
  });

  it("toasts an error and keeps the lightbox open when deletion fails", async () => {
    deletePhotoActionMock.mockResolvedValueOnce({ error: "Фото не знайдено" });
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    expect(toastErrorMock).toHaveBeenCalledWith("Фото не знайдено");
    // The confirmation dialog stays open on error (same as RemoveParticipantButton's
    // equivalent flow) - the lightbox behind it is inert (not accessible by role)
    // until it's dismissed, so close it first to confirm the lightbox itself
    // wasn't torn down by the failed deletion.
    await user.click(screen.getByRole("button", { name: "Скасувати" }));
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();
  });
});
