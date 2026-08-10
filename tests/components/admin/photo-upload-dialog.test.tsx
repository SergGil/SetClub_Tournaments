// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoUploadDialog } from "@/components/admin/photo-upload-dialog";
import type { confirmPhotoUploadAction } from "@/lib/actions/photos";

const { confirmPhotoUploadActionMock } = vi.hoisted(() => ({
  confirmPhotoUploadActionMock: vi.fn<typeof confirmPhotoUploadAction>(),
}));
vi.mock("@/lib/actions/photos", () => ({ confirmPhotoUploadAction: confirmPhotoUploadActionMock }));

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

function jpegFile(name: string, sizeBytes?: number) {
  const file = new File(["fake-image-bytes"], name, { type: "image/jpeg" });
  if (sizeBytes !== undefined) {
    Object.defineProperty(file, "size", { value: sizeBytes });
  }
  return file;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<PhotoUploadDialog tournamentId="t1" />);
  await user.click(screen.getByRole("button", { name: "Додати фото" }));
  return screen.getByLabelText("Файли фото");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PhotoUploadDialog (upload hint)", () => {
  it("shows the format/size/filename-length limits next to the file picker", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText(/JPEG, PNG, WEBP/)).toBeInTheDocument();
    expect(screen.getByText(/20 МБ/)).toBeInTheDocument();
    expect(screen.getByText(/200 символів/)).toBeInTheDocument();
  });
});

describe("PhotoUploadDialog (client-side validation)", () => {
  it("rejects an unsupported file type without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const input = await openDialog(user);

    // userEvent.upload() simulates the native picker's accept-attribute
    // filtering (it would never let a .txt through), but a real user can
    // still get a mismatched file past `accept` via drag-and-drop - so this
    // sets input.files directly and fires change, the same as that path.
    const badFile = new File(["not an image"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [badFile], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText("Непідтримуваний формат файлу")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects a file over the size limit without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const input = await openDialog(user);

    await user.upload(input, jpegFile("huge.jpg", 21 * 1024 * 1024));

    expect(await screen.findByText("Файл завеликий (>20 МБ)")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("PhotoUploadDialog (upload flow)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("presigns, PUTs to R2, confirms, and toasts once the batch finishes", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "tournaments/t1/a.jpg" }),
        } as Response;
      }
      if (url === "https://r2.example.com/upload") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPhotoUploadActionMock.mockResolvedValueOnce({});

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpegFile("photo.jpg"));

    await waitFor(() => expect(screen.getByText("Готово")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/photos/presign",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tournamentId: "t1",
          fileName: "photo.jpg",
          contentType: "image/jpeg",
          contentLength: 16,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example.com/upload",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(confirmPhotoUploadActionMock).toHaveBeenCalledWith("t1", "tournaments/t1/a.jpg");
    expect(toastSuccessMock).toHaveBeenCalledWith("Фото завантажено");
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // Regression guard for a real layout bug: `truncate` alone doesn't
    // shrink a flex item below its content's natural width, so a long
    // filename used to widen this row past the list's box, and
    // overflow-y-auto forces overflow-x into auto too - together producing
    // a spurious horizontal scrollbar that visually jittered the spinner.
    expect(screen.getByText("photo.jpg")).toHaveClass("min-w-0", "truncate");
  });

  it("refreshes the page exactly once for a multi-file batch, not once per photo", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "tournaments/t1/a.jpg" }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPhotoUploadActionMock.mockResolvedValue({});

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, [jpegFile("a.jpg"), jpegFile("b.jpg")]);

    await waitFor(() => expect(screen.getAllByText("Готово")).toHaveLength(2));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error message when presigning fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpegFile("photo.jpg"));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(confirmPhotoUploadActionMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("shows the action's error when confirming the upload fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "tournaments/t1/a.jpg" }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPhotoUploadActionMock.mockResolvedValueOnce({ error: "Турнір не знайдено" });

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpegFile("photo.jpg"));

    expect(await screen.findByText("Турнір не знайдено")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
