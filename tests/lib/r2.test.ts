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

  // The `?? "photo"` fallback in sanitizeFileName's implementation is
  // actually unreachable: String.prototype.split(...).pop() returns a
  // string (possibly empty) for any string input, including "", never
  // `undefined` - so a degenerate name (empty, or ending in a separator)
  // produces "" instead of the intended "photo" fallback. Documenting the
  // real behavior here rather than the intended-but-dead-code one; low
  // real-world stakes (this only feeds the tail of an already
  // randomUUID()-prefixed R2 key, and the presign endpoint is admin-gated),
  // but worth a fix in r2.ts itself at some point.
  it("produces an empty string (not the intended 'photo' fallback - dead code, see above) when the path ends in a separator", () => {
    expect(sanitizeFileName("some/dir/")).toBe("");
  });

  it("produces an empty string (not the intended 'photo' fallback) for an empty input", () => {
    expect(sanitizeFileName("")).toBe("");
  });

  it("caps the result at 100 characters, keeping the tail (extension) rather than the head", () => {
    const longName = `${"a".repeat(150)}.jpg`;
    const result = sanitizeFileName(longName);
    expect(result.length).toBe(100);
    expect(result.endsWith(".jpg")).toBe(true);
  });
});
