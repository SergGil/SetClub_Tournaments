// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressPhotoFile, PHOTO_MAX_DIMENSION } from "@/lib/image-compress";

function fakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() };
}

function pngFile(name: string, sizeBytes: number) {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

function stubCanvas(blob: Blob | null, contextAvailable = true) {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    contextAvailable ? ({ drawImage } as unknown as CanvasRenderingContext2D) : null,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
    callback(blob);
  });
  return { drawImage };
}

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("compressPhotoFile", () => {
  it("returns the original file when createImageBitmap isn't supported", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const file = pngFile("a.png", 1000);
    expect(await compressPhotoFile(file)).toBe(file);
  });

  it("returns the original file when decoding throws", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad image")));
    const file = pngFile("a.png", 1000);
    expect(await compressPhotoFile(file)).toBe(file);
  });

  it("returns the original file when the canvas 2d context is unavailable", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(4000, 3000)));
    stubCanvas(null, false);
    const file = pngFile("a.png", 1000);
    expect(await compressPhotoFile(file)).toBe(file);
  });

  it("returns the original file when encoding fails (toBlob yields null)", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(4000, 3000)));
    stubCanvas(null);
    const file = pngFile("a.png", 1000);
    expect(await compressPhotoFile(file)).toBe(file);
  });

  it("returns the original file when the compressed result isn't actually smaller", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(800, 600)));
    stubCanvas(new Blob([new Uint8Array(5000)], { type: "image/webp" }));
    const file = pngFile("a.png", 1000);
    expect(await compressPhotoFile(file)).toBe(file);
  });

  it("closes the decoded bitmap in every case, including failure paths", async () => {
    const bitmap = fakeBitmap(4000, 3000);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    stubCanvas(null, false);
    await compressPhotoFile(pngFile("a.png", 1000));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("returns a smaller WebP file, renamed, when compression helps", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(800, 600)));
    stubCanvas(new Blob([new Uint8Array(500)], { type: "image/webp" }));
    const file = pngFile("photo.png", 5000);

    const result = await compressPhotoFile(file);

    expect(result).not.toBe(file);
    expect(result.type).toBe("image/webp");
    expect(result.name).toBe("photo.webp");
    expect(result.size).toBe(500);
  });

  it("caps the long edge at PHOTO_MAX_DIMENSION, preserving aspect ratio", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(6000, 4000)));
    let capturedSize: { width: number; height: number } | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      capturedSize = { width: this.width, height: this.height };
      return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
      callback(new Blob([new Uint8Array(500)], { type: "image/webp" }));
    });

    await compressPhotoFile(pngFile("wide.png", 8_000_000));

    expect(capturedSize).toEqual({
      width: PHOTO_MAX_DIMENSION,
      height: Math.round((4000 / 6000) * PHOTO_MAX_DIMENSION),
    });
  });

  it("doesn't upscale an image already smaller than PHOTO_MAX_DIMENSION", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(fakeBitmap(800, 600)));
    let capturedSize: { width: number; height: number } | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      capturedSize = { width: this.width, height: this.height };
      return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback) {
      callback(new Blob([new Uint8Array(500)], { type: "image/webp" }));
    });

    await compressPhotoFile(pngFile("small.png", 5000));

    expect(capturedSize).toEqual({ width: 800, height: 600 });
  });
});
