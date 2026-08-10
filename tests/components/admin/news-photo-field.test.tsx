// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewsPhotoField } from "@/components/admin/news-photo-field";

function jpegFile(name: string, sizeBytes?: number) {
  const file = new File(["fake-image-bytes"], name, { type: "image/jpeg" });
  if (sizeBytes !== undefined) {
    Object.defineProperty(file, "size", { value: sizeBytes });
  }
  return file;
}

function hiddenInput(name: string) {
  return document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement createObjectURL - the field calls it once an
  // upload completes, to preview the picked file.
  URL.createObjectURL = vi.fn(() => "blob:preview");
});

describe("NewsPhotoField (client-side validation)", () => {
  it("rejects an unsupported file type without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<NewsPhotoField />);

    const input = screen.getByLabelText("Фото");
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
    render(<NewsPhotoField />);

    await user.upload(screen.getByLabelText("Фото"), jpegFile("huge.jpg", 21 * 1024 * 1024));

    expect(await screen.findByText("Файл завеликий (>20 МБ)")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("NewsPhotoField (upload flow)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("presigns, PUTs to R2, and stores the resulting key in a hidden field", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/news/photo-presign") {
        return {
          ok: true,
          json: async () => ({ uploadUrl: "https://r2.example.com/upload", key: "news/abc-photo.jpg" }),
        } as Response;
      }
      if (url === "https://r2.example.com/upload") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<NewsPhotoField />);
    await user.upload(screen.getByLabelText("Фото"), jpegFile("photo.jpg"));

    await waitFor(() => expect(hiddenInput("photoKey")).toHaveValue("news/abc-photo.jpg"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/news/photo-presign",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ fileName: "photo.jpg", contentType: "image/jpeg", contentLength: 16 }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example.com/upload",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(hiddenInput("removePhoto")).toHaveValue("false");
    expect(screen.getByRole("button", { name: /Прибрати фото/ })).toBeInTheDocument();
  });

  it("shows the server's error message when presigning fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<NewsPhotoField />);
    await user.upload(screen.getByLabelText("Фото"), jpegFile("photo.jpg"));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(hiddenInput("photoKey")).toHaveValue("");
  });
});

describe("NewsPhotoField (existing photo)", () => {
  it("shows a preview of the existing photo and lets the admin remove it", async () => {
    const user = userEvent.setup();
    render(<NewsPhotoField initialPhotoUrl="https://r2.example.com/news/old.jpg" />);

    expect(document.querySelector("img")).toHaveAttribute("src", "https://r2.example.com/news/old.jpg");
    expect(hiddenInput("removePhoto")).toHaveValue("false");

    await user.click(screen.getByRole("button", { name: /Прибрати фото/ }));

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(hiddenInput("removePhoto")).toHaveValue("true");
    expect(hiddenInput("photoKey")).toHaveValue("");
  });
});
