import { describe, expect, it } from "vitest";

import { safeCallbackPath } from "@/lib/safe-redirect";

describe("safeCallbackPath", () => {
  it("allows a plain relative path", () => {
    expect(safeCallbackPath("/tournaments/123")).toBe("/tournaments/123");
  });

  it("falls back to / when the value is undefined", () => {
    expect(safeCallbackPath(undefined)).toBe("/");
  });

  it("falls back to / for a path that doesn't start with a slash", () => {
    expect(safeCallbackPath("evil.example")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeCallbackPath("//evil.example")).toBe("/");
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/");
  });

  it("rejects a backslash-based protocol-relative bypass", () => {
    // Browsers resolve "/\/evil.example" as "https://evil.example" even
    // though it starts with a single "/" and has no "://" in it.
    expect(safeCallbackPath("/\\/evil.example")).toBe("/");
    expect(safeCallbackPath("\\/evil.example")).toBe("/");
    expect(safeCallbackPath("/\\evil.example")).toBe("/");
  });
});
