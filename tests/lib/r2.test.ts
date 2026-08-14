import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Only sanitizeFileName is under test here - createPresignedUploadUrl/
// deleteObject/publicPhotoUrl all need real R2_* env vars and touch the AWS
// SDK client, which getR2Client() only constructs lazily on first real use
// (see r2.ts's own comment), so importing the module for this one pure
// function needs no env vars and no SDK mocking.
import { sanitizeFileName } from "@/lib/r2";

describe("sanitizeFileName", () => {
  it("leaves an already-safe name unchanged", () => {
    expect(sanitizeFileName("photo.jpg")).toBe("photo.jpg");
  });

  it("strips a Unix directory portion, keeping only the base name", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
  });

  it("strips a Windows directory portion, keeping only the base name", () => {
    expect(sanitizeFileName("C:\\Users\\admin\\secret.jpg")).toBe("secret.jpg");
  });

  it("replaces every non-portable character with an underscore", () => {
    expect(sanitizeFileName("фото № 1 (фінал)!.jpg")).toBe("_______1_________.jpg");
  });

  it("falls back to 'photo' when the path ends in a separator (empty base name)", () => {
    expect(sanitizeFileName("some/dir/")).toBe("photo");
  });

  it("falls back to 'photo' for an empty input", () => {
    expect(sanitizeFileName("")).toBe("photo");
  });

  it("caps the result at 100 characters, keeping the tail (extension) rather than the head", () => {
    const longName = `${"a".repeat(150)}.jpg`;
    const result = sanitizeFileName(longName);
    expect(result.length).toBe(100);
    expect(result.endsWith(".jpg")).toBe(true);
  });
});
