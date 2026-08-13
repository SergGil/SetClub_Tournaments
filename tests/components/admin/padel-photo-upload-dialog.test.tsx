// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PadelPhotoUploadDialog } from "@/components/admin/padel-photo-upload-dialog";
import type { confirmPadelPhotoUploadAction } from "@/lib/actions/padel-photos";

const { confirmPadelPhotoUploadActionMock } = vi.hoisted(() => ({
  confirmPadelPhotoUploadActionMock: vi.fn<typeof confirmPadelPhotoUploadAction>(),
}));
vi.mock("@/lib/actions/padel-photos", () => ({
  confirmPadelPhotoUploadAction: confirmPadelPhotoUploadActionMock,
}));

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
  render(<PadelPhotoUploadDialog tournamentId="t1" />);
  await user.click(screen.getByRole("button", { name: "Додати фото" }));
  return screen.getByLabelText("Файли фото");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PadelPhotoUploadDialog (upload hint)", () => {
  it("shows the format/size/filename-length limits next to the file picker", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText(/JPEG, PNG, WEBP/)).toBeInTheDocument();
    expect(screen.getByText(/20 МБ/)).toBeInTheDocument();
    expect(screen.getByText(/200 символів/)).toBeInTheDocument();
  });
});

describe("PadelPhotoUploadDialog (client-side validation)", () => {
  it("rejects an unsupported file type without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const input = await openDialog(user);

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

describe("PadelPhotoUploadDialog (upload flow)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("presigns, PUTs to R2, confirms, and toasts once the batch finishes", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/padel-photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "padel-tournaments/t1/a.jpg" }),
        } as Response;
      }
      if (url === "https://r2.example.com/upload") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPadelPhotoUploadActionMock.mockResolvedValueOnce({});

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpegFile("photo.jpg"));

    await waitFor(() => expect(screen.getByText("Готово")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/padel-photos/presign",
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
    expect(confirmPadelPhotoUploadActionMock).toHaveBeenCalledWith("t1", "padel-tournaments/t1/a.jpg");
    expect(toastSuccessMock).toHaveBeenCalledWith("Фото завантажено");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the page exactly once for a multi-file batch, not once per photo", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/padel-photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "padel-tournaments/t1/a.jpg" }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPadelPhotoUploadActionMock.mockResolvedValue({});

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
    expect(confirmPadelPhotoUploadActionMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("shows the action's error when confirming the upload fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/padel-photos/presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "padel-tournaments/t1/a.jpg" }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    confirmPadelPhotoUploadActionMock.mockResolvedValueOnce({ error: "Турнір не знайдено" });

    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpegFile("photo.jpg"));

    expect(await screen.findByText("Турнір не знайдено")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
