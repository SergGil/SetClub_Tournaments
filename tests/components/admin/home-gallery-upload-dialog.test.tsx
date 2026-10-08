// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeGalleryUploadDialog } from "@/components/admin/home-gallery-upload-dialog";
import type { confirmHomeGalleryPhotoAction } from "@/lib/actions/home-gallery";

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn<typeof confirmHomeGalleryPhotoAction>() }));
vi.mock("@/lib/actions/home-gallery", () => ({ confirmHomeGalleryPhotoAction: confirmMock }));

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

// Canvas compression isn't what's under test (and jsdom has no canvas) - pass the file through.
vi.mock("@/lib/image-compress", () => ({ compressPhotoFile: async (file: File) => file }));

function jpeg(name: string, size?: number) {
  const file = new File(["fake-image-bytes"], name, { type: "image/jpeg" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<HomeGalleryUploadDialog />);
  await user.click(screen.getByRole("button", { name: "Додати фото" }));
  return screen.getByLabelText("Файли фото");
}

function mockFetch(handlers: { presign?: () => Response; put?: () => Response }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/home-gallery/presign") {
      return (
        handlers.presign?.() ??
        Response.json({ uploadUrl: "https://r2.example/put", key: "home-gallery/abc-photo.jpg" })
      );
    }
    void init;
    return handlers.put?.() ?? new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmMock.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());

describe("HomeGalleryUploadDialog", () => {
  it("shows the format/size limits and the event-name field", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText(/JPEG, PNG, WEBP/)).toBeInTheDocument();
    expect(screen.getByLabelText("Назва події")).toBeInTheDocument();
  });

  it("rejects an unsupported file type without touching the network", async () => {
    const fetchMock = mockFetch({});
    const user = userEvent.setup();
    const input = await openDialog(user);

    const bad = new File(["text"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [bad], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText("Непідтримуваний формат файлу")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a file over 20 MB without touching the network", async () => {
    const fetchMock = mockFetch({});
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpeg("huge.jpg", 21 * 1024 * 1024));

    expect(await screen.findByText("Файл завеликий (>20 МБ)")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("presigns, PUTs to storage, confirms with the batch's event name, then toasts and refreshes", async () => {
    const fetchMock = mockFetch({});
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.type(screen.getByLabelText("Назва події"), " Дегустація ");
    await user.upload(input, jpeg("a.jpg"));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("home-gallery/abc-photo.jpg", "Дегустація"));
    const [presignUrl, presignInit] = fetchMock.mock.calls[0];
    expect(presignUrl).toBe("/api/home-gallery/presign");
    expect(JSON.parse(presignInit!.body as string)).toMatchObject({ fileName: "a.jpg", contentType: "image/jpeg" });
    const [putUrl, putInit] = fetchMock.mock.calls[1];
    expect(putUrl).toBe("https://r2.example/put");
    expect(putInit).toMatchObject({ method: "PUT", headers: { "Content-Type": "image/jpeg" } });

    expect(await screen.findByText("Готово")).toBeInTheDocument();
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Фото завантажено"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("uses the plural toast for several files and applies one event name to all", async () => {
    mockFetch({});
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.type(screen.getByLabelText("Назва події"), "Фінал");
    await user.upload(input, [jpeg("a.jpg"), jpeg("b.jpg")]);

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Завантажено фото: 2"));
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(confirmMock.mock.calls.every(([, caption]) => caption === "Фінал")).toBe(true);
  });

  it("surfaces the presign error and never PUTs or confirms", async () => {
    const fetchMock = mockFetch({
      presign: () => Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpeg("a.jpg"));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the presign response has no error body", async () => {
    mockFetch({ presign: () => new Response("oops", { status: 500 }) });
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpeg("a.jpg"));
    expect(await screen.findByText("Не вдалося підготувати завантаження")).toBeInTheDocument();
  });

  it("reports a failed storage upload and skips the confirm", async () => {
    mockFetch({ put: () => new Response(null, { status: 500 }) });
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpeg("a.jpg"));

    expect(await screen.findByText("Не вдалося завантажити файл у сховище")).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("shows the server's confirm error and does not toast success", async () => {
    mockFetch({});
    confirmMock.mockResolvedValueOnce({ error: "Це фото вже завантажено" });
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.upload(input, jpeg("a.jpg"));

    expect(await screen.findByText("Це фото вже завантажено")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("starts clean each time it is reopened", async () => {
    mockFetch({});
    const user = userEvent.setup();
    const input = await openDialog(user);
    await user.type(screen.getByLabelText("Назва події"), "Подія");
    await user.upload(input, jpeg("a.jpg"));
    await screen.findByText("Готово");

    await user.click(screen.getByRole("button", { name: "Закрити" }));
    await waitFor(() => expect(screen.queryByLabelText("Назва події")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Додати фото" }));

    expect(await screen.findByLabelText("Назва події")).toHaveValue("");
    expect(screen.queryByText("Готово")).not.toBeInTheDocument();
  });
});
