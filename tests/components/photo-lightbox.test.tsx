// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoLightbox } from "@/components/photo-lightbox";

const { deleteActionMock, setCoverActionMock } = vi.hoisted(() => ({
  deleteActionMock: vi.fn(),
  setCoverActionMock: vi.fn(),
}));

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
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);
    expect(screen.getByRole("button", { name: "Фінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Півфінал" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Фото турніру" })).toBeInTheDocument();
  });
});

describe("PhotoLightbox (lightbox navigation)", () => {
  it("opens the clicked photo and disables prev/next at the ends", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);

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
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();

    // Dispatched straight onto `document`: this only proves the clamping
    // logic. It does NOT prove a real keyboard works - events from the
    // focused element inside the dialog never reach a bubble-phase document
    // listener (see the "real keyboard" test below).
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

  it("navigates with the real keyboard - keydown fired from the focused control inside the dialog, not onto `document`", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    // Focus is inside the dialog, as it always is for a keyboard user; the
    // Base UI dialog swallows keydown from there, so a plain bubble-phase
    // document listener never saw these (arrows silently did nothing).
    await waitFor(() => expect(document.activeElement?.closest("[role=dialog]")).not.toBeNull());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "Півфінал" })).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "Фото турніру" })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("img", { name: "Півфінал" })).toBeInTheDocument();
  });

  it("leaves modified arrow keys (Alt+← is browser back, Shift+arrows extend a selection) alone", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    await user.keyboard("{Meta>}{ArrowRight}{/Meta}");

    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();
  });

  it("stops listening for arrow keys once the lightbox is closed", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);

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
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);
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
    render(<PhotoLightbox photos={photos} canManage={false} deleteAction={deleteActionMock} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.queryByRole("button", { name: "Видалити фото" })).not.toBeInTheDocument();
  });

  it("shows the delete button for admins", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    expect(screen.getByRole("button", { name: "Видалити фото" })).toBeInTheDocument();
  });
});

describe("PhotoLightbox (delete flow)", () => {
  it("asks for confirmation instead of deleting immediately", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));

    expect(screen.getByRole("heading", { name: "Видалити фото?" })).toBeInTheDocument();
    expect(deleteActionMock).not.toHaveBeenCalled();
  });

  it("ignores arrow keys while the delete confirmation is open, so \"Видалити\" still deletes the photo it asked about", async () => {
    deleteActionMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);
    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await screen.findByText("Видалити фото?");

    // Focus moves into the confirmation a moment after it mounts; a keypress
    // in that gap comes from an element OUTSIDE the alertdialog, so the guard
    // can't rely on the event target being inside it.
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    expect(deleteActionMock).toHaveBeenCalledWith("p1");
  });

  it("does nothing if the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(deleteActionMock).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Фінал" })).toBeInTheDocument();
  });

  it("deletes the active photo, toasts success, and closes the lightbox", async () => {
    deleteActionMock.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);

    await user.click(screen.getByRole("button", { name: "Фінал" }));
    await user.click(screen.getByRole("button", { name: "Видалити фото" }));
    await user.click(screen.getByRole("button", { name: "Видалити" }));

    expect(deleteActionMock).toHaveBeenCalledWith("p1");
    expect(toastSuccessMock).toHaveBeenCalledWith("Фото видалено");
    // Removing the deleted photo from the grid is the parent's job (revalidatePath
    // + re-render with fresh data) - this component only closes the dialog on success.
    expect(screen.queryByRole("button", { name: "Закрити" })).not.toBeInTheDocument();
  });

  it("toasts an error and keeps the lightbox open when deletion fails", async () => {
    deleteActionMock.mockResolvedValueOnce({ error: "Фото не знайдено" });
    const user = userEvent.setup();
    render(<PhotoLightbox photos={photos} canManage={true} deleteAction={deleteActionMock} />);

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

describe("PhotoLightbox (cover)", () => {
  const coverPhotos = [
    { ...photos[0], isCover: true },
    { ...photos[1], isCover: false },
    { ...photos[2], isCover: false },
  ];

  it("offers no cover button without a setCoverAction, even to an admin", async () => {
    const user = userEvent.setup();
    render(<PhotoLightbox photos={coverPhotos} canManage deleteAction={deleteActionMock} />);
    await user.click(screen.getByRole("button", { name: /Півфінал/ }));
    expect(screen.queryByRole("button", { name: /обкладинк/i })).not.toBeInTheDocument();
  });

  it("offers no cover button to a non-admin, even when the action is passed", async () => {
    const user = userEvent.setup();
    render(
      <PhotoLightbox
        photos={coverPhotos}
        canManage={false}
        deleteAction={deleteActionMock}
        setCoverAction={setCoverActionMock}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Півфінал" }));
    expect(screen.queryByRole("button", { name: /обкладинк/i })).not.toBeInTheDocument();
  });

  it("badges the current cover for admins only", () => {
    const { unmount } = render(
      <PhotoLightbox photos={coverPhotos} canManage deleteAction={deleteActionMock} setCoverAction={setCoverActionMock} />,
    );
    expect(screen.getAllByText("Обкладинка")).toHaveLength(1);
    unmount();

    render(<PhotoLightbox photos={coverPhotos} canManage={false} deleteAction={deleteActionMock} />);
    expect(screen.queryByText("Обкладинка")).not.toBeInTheDocument();
  });

  it("makes the open photo the cover and confirms with a toast", async () => {
    setCoverActionMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <PhotoLightbox photos={coverPhotos} canManage deleteAction={deleteActionMock} setCoverAction={setCoverActionMock} />,
    );

    await user.click(screen.getByRole("button", { name: "Півфінал" }));
    await user.click(screen.getByRole("button", { name: "Зробити обкладинкою турніру" }));

    expect(setCoverActionMock).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Обкладинку турніру змінено"));
  });

  it("shows the server's error as a toast when making the cover fails", async () => {
    setCoverActionMock.mockResolvedValue({ error: "Фото не знайдено — можливо, його вже видалили" });
    const user = userEvent.setup();
    render(
      <PhotoLightbox photos={coverPhotos} canManage deleteAction={deleteActionMock} setCoverAction={setCoverActionMock} />,
    );

    await user.click(screen.getByRole("button", { name: "Півфінал" }));
    await user.click(screen.getByRole("button", { name: "Зробити обкладинкою турніру" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Фото не знайдено — можливо, його вже видалили"),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("disables the button on the photo that already is the cover", async () => {
    const user = userEvent.setup();
    render(
      <PhotoLightbox photos={coverPhotos} canManage deleteAction={deleteActionMock} setCoverAction={setCoverActionMock} />,
    );

    // The cover's thumbnail carries the badge text too, so its accessible name is longer.
    await user.click(screen.getByRole("button", { name: /Фінал/ }));
    const button = screen.getByRole("button", { name: "Це обкладинка турніру" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(setCoverActionMock).not.toHaveBeenCalled();
  });
});
